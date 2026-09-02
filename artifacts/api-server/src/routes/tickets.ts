import { Router, type IRouter } from "express";
import { db, ticketsTable, usersTable, ticketRepliesTable, attachmentsTable, userProductsTable } from "@workspace/db";
import { eq, desc, and, ilike, or, gte, lt, isNotNull, sql, type SQL } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { sendTicketReceivedEmail, sendUserReplyEmail } from "../lib/email";
import { sendTicketPush } from "../lib/push";
import { getSlaDueAt, type TicketPriority } from "../lib/sla";
import { writeAudit } from "../lib/audit";
import { parseTicketListQuery } from "../lib/ticketFilters";
import { validateImageAttachment } from "../lib/attachments";
import { autoExpireIfNeeded, isActiveProductAccess } from "../lib/productAccess";

const router: IRouter = Router();

router.get("/tickets", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const parsedQuery = parseTicketListQuery(req.query as Record<string, unknown>);
    if (!parsedQuery.ok) {
      res.status(400).json({ success: false, message: parsedQuery.message });
      return;
    }
    const { page, pageSize, search, status, priority, category, start, end } = parsedQuery.value;

    const conditions: SQL[] = [eq(ticketsTable.userId, userId)];
    if (status) conditions.push(eq(ticketsTable.status, status as "open" | "in-progress" | "resolved"));
    if (priority) conditions.push(eq(ticketsTable.priority, priority as "low" | "medium" | "high" | "critical"));
    if (category) conditions.push(eq(ticketsTable.category, category as "bug" | "feature" | "billing" | "account" | "other"));
    if (start) conditions.push(gte(ticketsTable.createdAt, start));
    if (end) conditions.push(lt(ticketsTable.createdAt, end));
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(or(
        ilike(ticketsTable.id, pattern),
        ilike(ticketsTable.productName, pattern),
        ilike(ticketsTable.description, pattern),
        sql`EXISTS (
          SELECT 1 FROM ${ticketRepliesTable}
          WHERE ${ticketRepliesTable.ticketId} = ${ticketsTable.id}
            AND ${ticketRepliesTable.message} ILIKE ${pattern}
        )`,
      )!);
    }

    const where = and(...conditions);
    const [tickets, totalRows] = await Promise.all([
      db.select().from(ticketsTable).where(where).orderBy(desc(ticketsTable.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ total: sql<number>`count(*)::int` }).from(ticketsTable).where(where),
    ]);
    const total = Number(totalRows[0]?.total ?? 0);

    res.json({
      success: true,
      message: "Tickets fetched",
      data: tickets,
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (err) {
    req.log.error({ err }, "getTickets error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

router.post("/tickets", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { productName, description, priority, category } = req.body as {
      productName?: string;
      description?: string;
      priority?: string;
      category?: string;
    };

    if (!productName || productName.trim().length < 2) {
      res.status(400).json({ success: false, message: "Product name must be at least 2 characters" });
      return;
    }
    if (!description || description.trim().length < 10) {
      res.status(400).json({ success: false, message: "Description must be at least 10 characters" });
      return;
    }

    const matchingProducts = await db
      .select()
      .from(userProductsTable)
      .where(and(
        eq(userProductsTable.userId, userId),
        eq(userProductsTable.productName, productName.trim()),
      ));
    const refreshedProducts = await Promise.all(matchingProducts.map((product) => autoExpireIfNeeded(product)));
    const productAccess = refreshedProducts.find((product) => isActiveProductAccess(product));
    if (!productAccess) {
      res.status(403).json({ success: false, message: "You do not have approved access to this product" });
      return;
    }

    const validPriorities = ["low", "medium", "high", "critical"];
    const validCategories = ["bug", "feature", "billing", "account", "other"];

    const [ticket] = await db
      .insert(ticketsTable)
      .values({
        userId,
        productName: productName.trim(),
        description: description.trim(),
        status: "open",
        priority: (validPriorities.includes(priority ?? "") ? priority : "medium") as "low" | "medium" | "high" | "critical",
        category: (validCategories.includes(category ?? "") ? category : "other") as "bug" | "feature" | "billing" | "account" | "other",
        slaDueAt: getSlaDueAt((validPriorities.includes(priority ?? "") ? priority : "medium") as TicketPriority),
      })
      .returning();

    const admins = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.role, "admin")).limit(100);
    const [requester] = await db
      .select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    void Promise.all(admins.map((admin) => sendTicketPush({
      pushToken: admin.pushToken,
      title: "New support ticket",
      body: `${ticket.productName} needs attention`,
      ticketId: ticket.id,
    })));
    if (requester?.email) {
      void sendTicketReceivedEmail({
        userEmail: requester.email,
        ticketId: ticket.id,
        productName: ticket.productName,
      });
    }
    void writeAudit({
      actorId: userId,
      actorEmail: requester?.email ?? null,
      action: "ticket_created",
      resourceType: "ticket",
      resourceId: ticket.id,
      meta: { priority: ticket.priority, category: ticket.category },
    });

    res.status(201).json({ success: true, message: "Ticket submitted successfully", data: ticket });
  } catch (err) {
    req.log.error({ err }, "createTicket error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

router.get("/tickets/satisfaction", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const ratedTickets = await db
      .select({
        id: ticketsTable.id,
        productName: ticketsTable.productName,
        rating: ticketsTable.rating,
        feedbackText: ticketsTable.feedbackText,
        resolvedAt: ticketsTable.resolvedAt,
        createdAt: ticketsTable.createdAt,
      })
      .from(ticketsTable)
      .where(and(eq(ticketsTable.userId, userId), isNotNull(ticketsTable.rating)))
      .orderBy(desc(ticketsTable.resolvedAt), desc(ticketsTable.createdAt));

    const ratings = ratedTickets.map((ticket) => ticket.rating).filter((rating): rating is number => rating !== null);
    const distribution = [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: ratings.filter((value) => value === rating).length,
    }));
    const recentFeedback = ratedTickets
      .filter((ticket) => Boolean(ticket.feedbackText?.trim()))
      .slice(0, 5)
      .map((ticket) => ({
        ticketId: ticket.id,
        productName: ticket.productName,
        rating: ticket.rating!,
        feedbackText: ticket.feedbackText!,
        resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
        createdAt: ticket.createdAt.toISOString(),
      }));

    res.json({
      success: true,
      message: "Satisfaction summary fetched",
      data: {
        ratedTicketCount: ratings.length,
        averageRating: ratings.length
          ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
          : null,
        distribution,
        recentFeedback,
      },
    });
  } catch (err) {
    req.log.error({ err }, "getTicketSatisfaction error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// GET attachments for a ticket
router.get("/tickets/:ticketId/attachments", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const ticketId = String(req.params["ticketId"]);

    const [ticket] = await db.select({ userId: ticketsTable.userId }).from(ticketsTable).where(eq(ticketsTable.id, ticketId)).limit(1);
    if (!ticket || ticket.userId !== userId) {
      res.status(403).json({ success: false, message: "Not authorized" });
      return;
    }

    const attachments = await db.select().from(attachmentsTable).where(eq(attachmentsTable.ticketId, ticketId)).orderBy(desc(attachmentsTable.createdAt));
    res.json({ success: true, message: "Attachments fetched", data: attachments });
  } catch (err) {
    req.log.error({ err }, "getTicketAttachments error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// POST upload attachment (base64 stored as data URL)
router.post("/tickets/:ticketId/attachments", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const ticketId = String(req.params["ticketId"]);
    const { fileName, mimeType, fileSize, base64Data } = req.body as {
      fileName?: string; mimeType?: string; fileSize?: number; base64Data?: string;
    };

    const attachmentInput = validateImageAttachment({ fileName, mimeType, fileSize, base64Data });
    if (!attachmentInput.ok) {
      res.status(400).json({ success: false, message: attachmentInput.message });
      return;
    }
    const safeAttachment = attachmentInput.value;

    const [ticket] = await db.select({ userId: ticketsTable.userId }).from(ticketsTable).where(eq(ticketsTable.id, ticketId)).limit(1);
    if (!ticket || ticket.userId !== userId) {
      res.status(403).json({ success: false, message: "Not authorized" });
      return;
    }

    const url = `data:${safeAttachment.mimeType};base64,${safeAttachment.base64Data}`;

    const [attachment] = await db.insert(attachmentsTable).values({
      ticketId,
      uploadedBy: userId,
      fileName: safeAttachment.fileName,
      mimeType: safeAttachment.mimeType,
      fileSize: safeAttachment.fileSize,
      url,
    }).returning();
    void writeAudit({
      actorId: userId,
      action: "ticket_attachment_added",
      resourceType: "ticket",
      resourceId: ticketId,
      meta: { fileName: safeAttachment.fileName, mimeType: safeAttachment.mimeType, fileSize: safeAttachment.fileSize },
    });

    res.status(201).json({ success: true, message: "Attachment uploaded", data: attachment });
  } catch (err) {
    req.log.error({ err }, "uploadTicketAttachment error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// GET single ticket detail with replies (user's own ticket)
router.get("/tickets/:ticketId", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const ticketId = String(req.params["ticketId"]);

    const [ticket] = await db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, ticketId))
      .limit(1);

    if (!ticket) {
      res.status(404).json({ success: false, message: "Ticket not found" });
      return;
    }

    if (ticket.userId !== userId) {
      res.status(403).json({ success: false, message: "Not authorized" });
      return;
    }

    const replies = await db
      .select()
      .from(ticketRepliesTable)
      .where(eq(ticketRepliesTable.ticketId, ticketId))
      .orderBy(ticketRepliesTable.createdAt);

    const attachments = await db
      .select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.ticketId, ticketId))
      .orderBy(desc(attachmentsTable.createdAt));

    res.json({
      success: true,
      message: "Ticket fetched",
      data: { ...ticket, replies, attachments },
    });
  } catch (err) {
    req.log.error({ err }, "getUserTicketDetail error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// POST user reply to their own ticket
router.post("/tickets/:ticketId/replies", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const ticketId = String(req.params["ticketId"]);
    const { message } = req.body as { message?: string };

    if (!message || message.trim().length === 0) {
      res.status(400).json({ success: false, message: "Message is required" });
      return;
    }

    const [ticket] = await db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, ticketId))
      .limit(1);

    if (!ticket) {
      res.status(404).json({ success: false, message: "Ticket not found" });
      return;
    }

    if (ticket.userId !== userId) {
      res.status(403).json({ success: false, message: "Not authorized" });
      return;
    }

    const [user] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    const [reply] = await db
      .insert(ticketRepliesTable)
      .values({
        ticketId,
        authorId: userId,
        authorName: user?.name ?? "User",
        authorRole: "user",
        message: message.trim(),
      })
      .returning();
    void writeAudit({
      actorId: userId,
      actorEmail: undefined,
      action: "ticket_reply_created",
      resourceType: "ticket",
      resourceId: ticketId,
    });

    // Email admin
    const adminEmail = process.env["EMAIL_USER"];
    if (adminEmail) {
      void sendUserReplyEmail({
        adminEmail,
        ticketId,
        productName: ticket.productName,
        userName: user?.name ?? "User",
        replyMessage: message.trim(),
      });
    }

    const admins = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.role, "admin")).limit(100);
    void Promise.all(admins.map((admin) => sendTicketPush({
      pushToken: admin.pushToken,
      title: "Customer replied",
      body: `${user?.name ?? "A customer"} replied on ${ticket.productName}`,
      ticketId,
    })));

    res.status(201).json({ success: true, message: "Reply posted", data: reply });
  } catch (err) {
    req.log.error({ err }, "createUserTicketReply error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

router.patch("/tickets/:ticketId/rating", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const ticketId = String(req.params["ticketId"]);
    const rating = Number(req.body?.rating);
    const feedbackText = typeof req.body?.feedbackText === "string" ? req.body.feedbackText.trim() : null;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
      return;
    }

    const [ticket] = await db.select().from(ticketsTable).where(and(eq(ticketsTable.id, ticketId), eq(ticketsTable.userId, userId))).limit(1);
    if (!ticket) {
      res.status(404).json({ success: false, message: "Ticket not found" });
      return;
    }
    if (ticket.status !== "resolved") {
      res.status(400).json({ success: false, message: "Tickets can only be rated after resolution" });
      return;
    }
    if (ticket.rating !== null) {
      res.status(409).json({ success: false, message: "This ticket has already been rated" });
      return;
    }

    const [updated] = await db.update(ticketsTable)
      .set({ rating, feedbackText: feedbackText || null })
      .where(eq(ticketsTable.id, ticketId))
      .returning();
    void writeAudit({
      actorId: userId,
      action: "ticket_rated",
      resourceType: "ticket",
      resourceId: ticketId,
      meta: { rating },
    });
    const replies = await db.select().from(ticketRepliesTable).where(eq(ticketRepliesTable.ticketId, ticketId)).orderBy(ticketRepliesTable.createdAt);
    const attachments = await db.select().from(attachmentsTable).where(eq(attachmentsTable.ticketId, ticketId)).orderBy(desc(attachmentsTable.createdAt));

    res.json({ success: true, message: "Thanks for your feedback", data: { ...updated, replies, attachments } });
  } catch (err) {
    req.log.error({ err }, "rateTicket error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

export default router;
