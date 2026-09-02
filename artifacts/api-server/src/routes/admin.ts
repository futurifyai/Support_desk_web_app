import { Router, type IRouter } from "express";
import { db, ticketsTable, usersTable, ticketRepliesTable, attachmentsTable, auditLogsTable, userProductsTable } from "@workspace/db";
import { desc, eq, asc, sql, and, or, ilike, gte, lte, type SQL } from "drizzle-orm";
import { requireAdmin, type AuthenticatedRequest } from "../middlewares/auth";
import { sendAdminReplyEmail, sendStatusUpdateEmail } from "../lib/email";
import { sendTicketPush } from "../lib/push";
import { writeAudit } from "../lib/audit";
import { parseAdminTicketListQuery, parseAdminUserListQuery, parseAuditLogQuery } from "../lib/adminFilters";
import {
  createAdminUserSchema,
  createUserProductSchema,
  formatValidationError,
  parseProductDate,
  updateUserProductSchema,
  validateProductDateRange,
} from "../lib/userProductValidation";
import { autoExpireIfNeeded } from "../lib/productAccess";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

function buildTextPdf(lines: string[]): Buffer {
  const safeLine = (value: string) =>
    value
      .replace(/[\\()]/g, "\\$&")
      .replace(/[^\x20-\x7e]/g, "?");
  const content = [
    "BT",
    "/F1 10 Tf",
    "50 790 Td",
    "14 TL",
    ...lines.flatMap((line, index) => [`(${safeLine(line)}) Tj`, ...(index < lines.length - 1 ? ["T*"] : [])]),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, "utf8"));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output, "utf8");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, "utf8");
}

// GET /admin/analytics — summary stats for the admin dashboard
router.get("/admin/analytics", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // Total counts by status and priority
    const allTickets = await db
      .select({
        id: ticketsTable.id,
        productName: ticketsTable.productName,
        status: ticketsTable.status,
        priority: ticketsTable.priority,
        category: ticketsTable.category,
        rating: ticketsTable.rating,
        feedbackText: ticketsTable.feedbackText,
        resolvedAt: ticketsTable.resolvedAt,
        createdAt: ticketsTable.createdAt,
      })
      .from(ticketsTable);

    let openCount = 0, inProgressCount = 0, resolvedCount = 0;
    let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0;
    const categoryMap: Record<string, number> = {};
    let totalResolutionMs = 0;
    let resolvedWithTimeCount = 0;

    for (const t of allTickets) {
      if (t.status === "open") openCount++;
      else if (t.status === "in-progress") inProgressCount++;
      else if (t.status === "resolved") resolvedCount++;

      if (t.priority === "critical") criticalCount++;
      else if (t.priority === "high") highCount++;
      else if (t.priority === "medium") mediumCount++;
      else if (t.priority === "low") lowCount++;

      categoryMap[t.category] = (categoryMap[t.category] ?? 0) + 1;

      if (t.status === "resolved" && t.resolvedAt && t.createdAt) {
        const resolvedMs = (t.resolvedAt instanceof Date ? t.resolvedAt : new Date(t.resolvedAt)).getTime();
        const createdMs = (t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt)).getTime();
        if (resolvedMs > createdMs) {
          totalResolutionMs += resolvedMs - createdMs;
          resolvedWithTimeCount++;
        }
      }
    }

    const totalTickets = allTickets.length;
    const byCategory = Object.entries(categoryMap).map(([category, count]) => ({ category, count }));

    const avgResolutionHours: number | null =
      resolvedWithTimeCount > 0
        ? Math.round((totalResolutionMs / resolvedWithTimeCount / 3_600_000) * 10) / 10
        : null;

    const ratings = allTickets
      .map((ticket) => ticket.rating)
      .filter((rating): rating is number => rating !== null);
    const satisfaction = {
      ratedTicketCount: ratings.length,
      averageRating: ratings.length
        ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
        : null,
      distribution: [1, 2, 3, 4, 5].map((rating) => ({
        rating,
        count: ratings.filter((value) => value === rating).length,
      })),
      recentFeedback: allTickets
        .filter((ticket) => ticket.rating !== null && Boolean(ticket.feedbackText?.trim()))
        .sort((a, b) => {
          const aDate = a.resolvedAt ?? a.createdAt;
          const bDate = b.resolvedAt ?? b.createdAt;
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        })
        .slice(0, 10)
        .map((ticket) => ({
          ticketId: ticket.id,
          productName: ticket.productName,
          rating: ticket.rating!,
          feedbackText: ticket.feedbackText!.trim(),
          resolvedAt: ticket.resolvedAt,
          createdAt: ticket.createdAt,
        })),
    };

    // Weekly trend (last 7 days) using raw SQL
    const trendRows = await db.execute(sql`
      SELECT
        TO_CHAR(DATE(created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS count
      FROM tickets
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at AT TIME ZONE 'UTC')
      ORDER BY date
    `);

    const trendRowsArr = (Array.isArray(trendRows) ? trendRows : (trendRows as { rows: unknown[] }).rows) as { date: string; count: number }[];
    const weeklyTrend = trendRowsArr.map((r) => ({
      date: r.date,
      count: Number(r.count),
    }));

    // Monthly trend (last 30 days)
    const monthlyTrendRows = await db.execute(sql`
      SELECT
        TO_CHAR(DATE(created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS count
      FROM tickets
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at AT TIME ZONE 'UTC')
      ORDER BY date
    `);

    const monthlyTrendArr = (Array.isArray(monthlyTrendRows) ? monthlyTrendRows : (monthlyTrendRows as { rows: unknown[] }).rows) as { date: string; count: number }[];
    const monthlyTrend = monthlyTrendArr.map((r) => ({
      date: r.date,
      count: Number(r.count),
    }));

    // Top agents by resolved tickets
    const topAgentRows = await db
      .select({
        agentId: ticketsTable.assignedTo,
        agentName: usersTable.name,
        resolvedCount: sql<number>`COUNT(*)::int`,
      })
      .from(ticketsTable)
      .innerJoin(usersTable, eq(ticketsTable.assignedTo, usersTable.id))
      .where(eq(ticketsTable.status, "resolved"))
      .groupBy(ticketsTable.assignedTo, usersTable.name)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(5);

    const topAgents = topAgentRows.map((r) => ({
      agentId: r.agentId,
      agentName: r.agentName,
      resolvedCount: Number(r.resolvedCount),
    }));

    res.json({
      success: true,
      message: "Analytics fetched",
      data: {
        totalTickets,
        openCount,
        inProgressCount,
        resolvedCount,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        byCategory,
        weeklyTrend,
        monthlyTrend,
        avgResolutionHours,
        topAgents,
        satisfaction,
      },
    });
  } catch (err) {
    req.log.error({ err }, "getAdminAnalytics error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// GET /admin/analytics/export.csv — bounded CSV export of tickets
router.get("/admin/analytics/export.csv", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const startDate = String(req.query["startDate"] ?? "");
    const endDate = String(req.query["endDate"] ?? "");
    const status = String(req.query["status"] ?? "");
    const priority = String(req.query["priority"] ?? "");

    const filters: SQL[] = [];
    if (startDate) filters.push(gte(ticketsTable.createdAt, new Date(startDate)));
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filters.push(lte(ticketsTable.createdAt, end));
    }
    if (["open", "in-progress", "resolved"].includes(status))
      filters.push(eq(ticketsTable.status, status as "open" | "in-progress" | "resolved"));
    if (["low", "medium", "high", "critical"].includes(priority))
      filters.push(eq(ticketsTable.priority, priority as "low" | "medium" | "high" | "critical"));

    // Hard cap at 5000 rows for safety
    const rows = await db
      .select({
        id: ticketsTable.id,
        userId: ticketsTable.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
        productName: ticketsTable.productName,
        status: ticketsTable.status,
        priority: ticketsTable.priority,
        category: ticketsTable.category,
        assignedTo: ticketsTable.assignedTo,
        rating: ticketsTable.rating,
        createdAt: ticketsTable.createdAt,
        resolvedAt: ticketsTable.resolvedAt,
        slaDueAt: ticketsTable.slaDueAt,
        slaEscalated: ticketsTable.slaEscalated,
      })
      .from(ticketsTable)
      .innerJoin(usersTable, eq(ticketsTable.userId, usersTable.id))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(ticketsTable.createdAt))
      .limit(5000);

    const escape = (v: unknown): string => {
      let s = v === null || v === undefined ? "" : String(v);
      // Spreadsheet software evaluates fields beginning with these characters.
      // Prefix with a literal apostrophe so exported customer content is data.
      if (/^\s*[=+\-@]/.test(s)) s = `'${s}`;
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const headers = [
      "id", "userId", "userName", "userEmail", "productName",
      "status", "priority", "category", "assignedTo",
      "rating", "createdAt", "resolvedAt", "slaDueAt", "slaEscalated",
    ];

    const lines: string[] = [headers.join(",")];
    for (const r of rows) {
      lines.push([
        escape(r.id),
        escape(r.userId),
        escape(r.userName),
        escape(r.userEmail),
        escape(r.productName),
        escape(r.status),
        escape(r.priority),
        escape(r.category),
        escape(r.assignedTo),
        escape(r.rating),
        escape(r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt),
        escape(r.resolvedAt instanceof Date ? r.resolvedAt.toISOString() : r.resolvedAt),
        escape(r.slaDueAt instanceof Date ? r.slaDueAt.toISOString() : r.slaDueAt),
        escape(r.slaEscalated),
      ].join(","));
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="tickets-export-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(lines.join("\r\n"));
  } catch (err) {
    req.log.error({ err }, "exportAnalyticsCsv error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// GET /admin/analytics/export.pdf — compact, shareable summary report
router.get("/admin/analytics/export.pdf", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const rows = await db
      .select({
        productName: ticketsTable.productName,
        status: ticketsTable.status,
        priority: ticketsTable.priority,
        category: ticketsTable.category,
        createdAt: ticketsTable.createdAt,
      })
      .from(ticketsTable)
      .orderBy(desc(ticketsTable.createdAt))
      .limit(42);
    const statusCounts = rows.reduce<Record<string, number>>((counts, row) => {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
      return counts;
    }, {});
    const lines = [
      "SupportDesk ticket report",
      `Generated: ${new Date().toISOString().slice(0, 10)} | Showing latest ${rows.length} tickets`,
      `Open: ${statusCounts.open ?? 0} | In progress: ${statusCounts["in-progress"] ?? 0} | Resolved: ${statusCounts.resolved ?? 0}`,
      "",
      "Recent tickets",
      ...rows.map((row) => {
        const date = row.createdAt instanceof Date ? row.createdAt.toISOString().slice(0, 10) : String(row.createdAt).slice(0, 10);
        return `${date} | ${row.priority.toUpperCase()} | ${row.status} | ${row.category} | ${row.productName.slice(0, 56)}`;
      }),
    ];
    const pdf = buildTextPdf(lines);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="supportdesk-report-${new Date().toISOString().slice(0, 10)}.pdf"`);
    res.send(pdf);
  } catch (err) {
    req.log.error({ err }, "exportAnalyticsPdf error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// GET /admin/users/ticket-stats — per-user ticket frequency with timestamps (admin only)
router.get("/admin/users/ticket-stats", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const rows = await db
      .select({
        id: ticketsTable.id,
        userId: ticketsTable.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
        productName: ticketsTable.productName,
        status: ticketsTable.status,
        priority: ticketsTable.priority,
        category: ticketsTable.category,
        createdAt: ticketsTable.createdAt,
      })
      .from(ticketsTable)
      .innerJoin(usersTable, eq(ticketsTable.userId, usersTable.id))
      .orderBy(asc(ticketsTable.userId), desc(ticketsTable.createdAt));

    const userMap = new Map<string, {
      userId: string;
      userName: string;
      userEmail: string;
      tickets: { id: string; productName: string; status: string; priority: string; category: string; createdAt: string }[];
    }>();

    for (const row of rows) {
      const createdAtStr = row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt);

      if (!userMap.has(row.userId)) {
        userMap.set(row.userId, {
          userId: row.userId,
          userName: row.userName,
          userEmail: row.userEmail,
          tickets: [],
        });
      }
      userMap.get(row.userId)!.tickets.push({
        id: row.id,
        productName: row.productName,
        status: row.status,
        priority: row.priority,
        category: row.category,
        createdAt: createdAtStr,
      });
    }

    const stats = Array.from(userMap.values())
      .map((u) => ({
        userId: u.userId,
        userName: u.userName,
        userEmail: u.userEmail,
        ticketCount: u.tickets.length,
        firstTicketAt: u.tickets[u.tickets.length - 1]?.createdAt ?? "",
        lastTicketAt: u.tickets[0]?.createdAt ?? "",
        tickets: u.tickets,
      }))
      .sort((a, b) => b.ticketCount - a.ticketCount);

    res.json({ success: true, message: "User ticket stats fetched", data: stats });
  } catch (err) {
    req.log.error({ err }, "getAdminUserTicketStats error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// POST /admin/users — create a customer account without exposing its password hash
router.post("/admin/users", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = createAdminUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: formatValidationError(parsed.error) });
      return;
    }
    const email = parsed.data.email.toLowerCase();
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ success: false, message: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const [user] = await db.insert(usersTable).values({
      name: parsed.data.name,
      email,
      passwordHash,
      role: "user",
    }).returning({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    });
    if (!user) {
      res.status(500).json({ success: false, message: "Unable to create user" });
      return;
    }

    void writeAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      action: "admin_create_user",
      resourceType: "user",
      resourceId: user.id,
      meta: { email: user.email },
    });
    res.status(201).json({
      success: true,
      message: "User created. Share these credentials securely.",
      data: { user, temporaryPassword: parsed.data.password },
    });
  } catch (err) {
    req.log.error({ err }, "createAdminUser error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// GET /admin/users — paginated customer and admin directory
router.get("/admin/users", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = parseAdminUserListQuery(req.query as Record<string, unknown>);
    if (!parsed.ok) {
      res.status(400).json({ success: false, message: parsed.message });
      return;
    }
    const { page, pageSize, search } = parsed.value;
    const searchPattern = `%${search}%`;
    const where = search
      ? or(ilike(usersTable.name, searchPattern), ilike(usersTable.email, searchPattern))
      : undefined;
    const [users, totalRows] = await Promise.all([
      db.select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      }).from(usersTable).where(where).orderBy(asc(usersTable.name)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ total: sql<number>`count(*)::int` }).from(usersTable).where(where),
    ]);
    const total = Number(totalRows[0]?.total ?? 0);
    res.json({
      success: true,
      message: "Users fetched",
      data: users,
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (err) {
    req.log.error({ err }, "getAdminUsers error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

async function getUserForProductAccess(userId: string) {
  const [user] = await db.select({ id: usersTable.id, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user;
}

// GET /admin/users/:userId/products
router.get("/admin/users/:userId/products", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = String(req.params["userId"]);
    if (!await getUserForProductAccess(userId)) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
    const products = await db.select().from(userProductsTable)
      .where(eq(userProductsTable.userId, userId))
      .orderBy(desc(userProductsTable.createdAt));
    const refreshedProducts = await Promise.all(products.map((product) => autoExpireIfNeeded(product)));
    res.json({ success: true, message: "Product access fetched", data: refreshedProducts });
  } catch (err) {
    req.log.error({ err }, "getAdminUserProducts error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// POST /admin/users/:userId/products
router.post("/admin/users/:userId/products", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = String(req.params["userId"]);
    if (!await getUserForProductAccess(userId)) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
    const parsed = createUserProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: formatValidationError(parsed.error) });
      return;
    }
    const startDate = parseProductDate(parsed.data.startDate);
    const endDate = parseProductDate(parsed.data.endDate, true);
    const dateError = validateProductDateRange(startDate, endDate);
    if (dateError) {
      res.status(400).json({ success: false, message: dateError });
      return;
    }
    const [product] = await db.insert(userProductsTable).values({
      userId,
      productName: parsed.data.productName,
      startDate,
      endDate,
      status: "pending",
    }).returning();
    if (!product) {
      res.status(500).json({ success: false, message: "Unable to create product access" });
      return;
    }
    void writeAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      action: "product_access_created",
      resourceType: "user_product",
      resourceId: product.id,
      meta: { userId, productName: product.productName },
    });
    res.status(201).json({ success: true, message: "Product access added", data: product });
  } catch (err) {
    req.log.error({ err }, "createUserProduct error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// PATCH /admin/users/:userId/products/:productId
router.patch("/admin/users/:userId/products/:productId", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = String(req.params["userId"]);
    const productId = String(req.params["productId"]);
    const parsed = updateUserProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: formatValidationError(parsed.error) });
      return;
    }
    const [existing] = await db.select().from(userProductsTable).where(and(
      eq(userProductsTable.id, productId),
      eq(userProductsTable.userId, userId),
    )).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, message: "Product access not found" });
      return;
    }
    const startDate = parsed.data.startDate === undefined ? existing.startDate : parseProductDate(parsed.data.startDate);
    const endDate = parsed.data.endDate === undefined ? existing.endDate : parseProductDate(parsed.data.endDate, true);
    const dateError = validateProductDateRange(startDate, endDate);
    if (dateError) {
      res.status(400).json({ success: false, message: dateError });
      return;
    }
    if (parsed.data.status === "approved" && endDate && endDate <= new Date()) {
      res.status(400).json({
        success: false,
        message: "Cannot approve product access with an end date in the past. Set a new end date first.",
      });
      return;
    }
    const datesChanged = parsed.data.startDate !== undefined || parsed.data.endDate !== undefined;
    const [updated] = await db.update(userProductsTable).set({
      ...(parsed.data.productName !== undefined ? { productName: parsed.data.productName } : {}),
      ...(parsed.data.startDate !== undefined ? { startDate } : {}),
      ...(parsed.data.endDate !== undefined ? { endDate } : {}),
      ...(parsed.data.status === "approved" ? {
        status: "approved" as const,
        approvedBy: req.user!.userId,
        approvedAt: new Date(),
        expiredAt: null,
      } : {}),
      ...(parsed.data.status === "disapproved" ? {
        status: "disapproved" as const,
        approvedBy: null,
        approvedAt: null,
        expiredAt: null,
      } : {}),
    }).where(and(
      eq(userProductsTable.id, productId),
      eq(userProductsTable.userId, userId),
    )).returning();
    if (!updated) {
      res.status(404).json({ success: false, message: "Product access not found" });
      return;
    }
    if (parsed.data.status) {
      void writeAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        action: `product_access_${parsed.data.status}`,
        resourceType: "user_product",
        resourceId: productId,
        meta: { userId, productName: updated.productName },
      });
    } else if (datesChanged) {
      void writeAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        action: "product_access_dates_updated",
        resourceType: "user_product",
        resourceId: productId,
        meta: {
          userId,
          productName: updated.productName,
          oldStartDate: existing.startDate?.toISOString() ?? null,
          newStartDate: updated.startDate?.toISOString() ?? null,
          oldEndDate: existing.endDate?.toISOString() ?? null,
          newEndDate: updated.endDate?.toISOString() ?? null,
        },
      });
    }
    res.json({ success: true, message: "Product access updated", data: updated });
  } catch (err) {
    req.log.error({ err }, "updateUserProduct error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// DELETE /admin/users/:userId/products/:productId
router.delete("/admin/users/:userId/products/:productId", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = String(req.params["userId"]);
    const productId = String(req.params["productId"]);
    const [deleted] = await db.delete(userProductsTable).where(and(
      eq(userProductsTable.id, productId),
      eq(userProductsTable.userId, userId),
    )).returning({ id: userProductsTable.id, productName: userProductsTable.productName });
    if (!deleted) {
      res.status(404).json({ success: false, message: "Product access not found" });
      return;
    }
    void writeAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      action: "product_access_deleted",
      resourceType: "user_product",
      resourceId: productId,
      meta: { userId, productName: deleted.productName },
    });
    res.json({ success: true, message: "Product access removed", data: deleted });
  } catch (err) {
    req.log.error({ err }, "deleteUserProduct error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// GET /admin/products/distinct — existing product names for admin suggestions
router.get("/admin/products/distinct", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const products = await db.select({ productName: userProductsTable.productName })
      .from(userProductsTable)
      .groupBy(userProductsTable.productName)
      .orderBy(asc(userProductsTable.productName))
      .limit(500);
    res.json({ success: true, message: "Product names fetched", data: products.map((product) => product.productName) });
  } catch (err) {
    req.log.error({ err }, "getDistinctProducts error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// GET all tickets (joined with user)
router.get("/admin/tickets", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const parsedQuery = parseAdminTicketListQuery(req.query as Record<string, unknown>);
    if (!parsedQuery.ok) {
      res.status(400).json({ success: false, message: parsedQuery.message });
      return;
    }
    const { page, pageSize, search, status, priority, category, assignedTo, sort } = parsedQuery.value;
    const filters: SQL[] = [];
    if (search) filters.push(ilike(ticketsTable.productName, `%${search}%`));
    if (status) filters.push(eq(ticketsTable.status, status));
    if (priority) filters.push(eq(ticketsTable.priority, priority));
    if (category) filters.push(eq(ticketsTable.category, category));
    if (assignedTo) filters.push(eq(ticketsTable.assignedTo, assignedTo));

    const rows = await db
      .select({
        id: ticketsTable.id,
        userId: ticketsTable.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
        productName: ticketsTable.productName,
        description: ticketsTable.description,
        status: ticketsTable.status,
        priority: ticketsTable.priority,
        category: ticketsTable.category,
        assignedTo: ticketsTable.assignedTo,
        slaDueAt: ticketsTable.slaDueAt,
        slaEscalated: ticketsTable.slaEscalated,
        rating: ticketsTable.rating,
        feedbackText: ticketsTable.feedbackText,
        createdAt: ticketsTable.createdAt,
      })
      .from(ticketsTable)
      .innerJoin(usersTable, eq(ticketsTable.userId, usersTable.id))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(sort === "oldest" ? asc(ticketsTable.createdAt) : sort === "sla-soonest" ? asc(ticketsTable.slaDueAt) : desc(ticketsTable.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    res.json({ success: true, message: "All tickets fetched", data: rows });
  } catch (err) {
    req.log.error({ err }, "getAdminTickets error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// GET single ticket with replies
router.get("/admin/tickets/:ticketId", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const ticketId = String(req.params["ticketId"]);

    const [ticket] = await db
      .select({
        id: ticketsTable.id,
        userId: ticketsTable.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
        productName: ticketsTable.productName,
        description: ticketsTable.description,
        status: ticketsTable.status,
        priority: ticketsTable.priority,
        category: ticketsTable.category,
        assignedTo: ticketsTable.assignedTo,
        rating: ticketsTable.rating,
        feedbackText: ticketsTable.feedbackText,
        resolvedAt: ticketsTable.resolvedAt,
        slaDueAt: ticketsTable.slaDueAt,
        slaEscalated: ticketsTable.slaEscalated,
        createdAt: ticketsTable.createdAt,
      })
      .from(ticketsTable)
      .innerJoin(usersTable, eq(ticketsTable.userId, usersTable.id))
      .where(eq(ticketsTable.id, ticketId))
      .limit(1);

    if (!ticket) {
      res.status(404).json({ success: false, message: "Ticket not found" });
      return;
    }

    const assignedAgent = ticket.assignedTo
      ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, ticket.assignedTo)).limit(1)
      : [];

    const replies = await db
      .select()
      .from(ticketRepliesTable)
      .where(eq(ticketRepliesTable.ticketId, ticketId))
      .orderBy(ticketRepliesTable.createdAt);

    const attachments = await db
      .select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.ticketId, ticketId))
      .orderBy(attachmentsTable.createdAt);

    res.json({
      success: true,
      message: "Ticket fetched",
      data: { ...ticket, assignedToName: assignedAgent[0]?.name ?? null, replies, attachments },
    });
  } catch (err) {
    req.log.error({ err }, "getAdminTicketDetail error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// PATCH update ticket status
router.patch("/admin/tickets/:ticketId/status", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const ticketId = String(req.params["ticketId"]);
    const { status } = req.body as { status?: string };

    const validStatuses = ["open", "in-progress", "resolved"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ success: false, message: "Invalid status value" });
      return;
    }

    const [updated] = await db
      .update(ticketsTable)
      .set({
        status: status as "open" | "in-progress" | "resolved",
        ...(status === "resolved" ? { resolvedAt: new Date() } : {}),
      })
      .where(eq(ticketsTable.id, ticketId))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, message: "Ticket not found" });
      return;
    }

    const [ticketWithUser] = await db
      .select({
        id: ticketsTable.id,
        userId: ticketsTable.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
        productName: ticketsTable.productName,
        description: ticketsTable.description,
        status: ticketsTable.status,
        priority: ticketsTable.priority,
        category: ticketsTable.category,
        createdAt: ticketsTable.createdAt,
      })
      .from(ticketsTable)
      .innerJoin(usersTable, eq(ticketsTable.userId, usersTable.id))
      .where(eq(ticketsTable.id, ticketId))
      .limit(1);

    const replies = await db
      .select()
      .from(ticketRepliesTable)
      .where(eq(ticketRepliesTable.ticketId, ticketId))
      .orderBy(ticketRepliesTable.createdAt);

    const attachments = await db
      .select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.ticketId, ticketId))
      .orderBy(attachmentsTable.createdAt);

    void writeAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      action: "ticket_status_update",
      resourceType: "ticket",
      resourceId: ticketId,
      meta: { newStatus: status, ticketUserId: updated.userId },
    });

    if (ticketWithUser?.userEmail) {
      void sendStatusUpdateEmail({
        userEmail: ticketWithUser.userEmail,
        ticketId,
        productName: ticketWithUser.productName,
        newStatus: status,
      });
    }
    const [recipient] = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, updated.userId)).limit(1);
    void sendTicketPush({
      pushToken: recipient?.pushToken ?? null,
      title: "Ticket status updated",
      body: `${ticketWithUser?.productName ?? "Your ticket"} is now ${status.replace("-", " ")}`,
      ticketId,
    });

    res.json({
      success: true,
      message: "Status updated",
      data: { ...ticketWithUser, assignedToName: null, replies, attachments },
    });
  } catch (err) {
    req.log.error({ err }, "updateTicketStatus error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// PATCH update ticket priority
router.patch("/admin/tickets/:ticketId/priority", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const ticketId = String(req.params["ticketId"]);
    const { priority } = req.body as { priority?: string };

    const validPriorities = ["low", "medium", "high", "critical"];
    if (!priority || !validPriorities.includes(priority)) {
      res.status(400).json({ success: false, message: "Invalid priority value" });
      return;
    }

    const [updated] = await db
      .update(ticketsTable)
      .set({ priority: priority as "low" | "medium" | "high" | "critical" })
      .where(eq(ticketsTable.id, ticketId))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, message: "Ticket not found" });
      return;
    }

    const [ticketWithUser] = await db
      .select({
        id: ticketsTable.id,
        userId: ticketsTable.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
        productName: ticketsTable.productName,
        description: ticketsTable.description,
        status: ticketsTable.status,
        priority: ticketsTable.priority,
        category: ticketsTable.category,
        createdAt: ticketsTable.createdAt,
      })
      .from(ticketsTable)
      .innerJoin(usersTable, eq(ticketsTable.userId, usersTable.id))
      .where(eq(ticketsTable.id, ticketId))
      .limit(1);

    const replies = await db
      .select()
      .from(ticketRepliesTable)
      .where(eq(ticketRepliesTable.ticketId, ticketId))
      .orderBy(ticketRepliesTable.createdAt);

    const attachments = await db
      .select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.ticketId, ticketId))
      .orderBy(attachmentsTable.createdAt);

    void writeAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      action: "ticket_priority_update",
      resourceType: "ticket",
      resourceId: ticketId,
      meta: { newPriority: priority, ticketUserId: updated.userId },
    });

    res.json({
      success: true,
      message: "Priority updated",
      data: { ...ticketWithUser, assignedToName: null, replies, attachments },
    });
  } catch (err) {
    req.log.error({ err }, "updateTicketPriority error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// GET all admin agents
router.get("/admin/agents", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const agents = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"))
      .limit(100);
    const agentsWithLoad = await Promise.all(agents.map(async (agent) => {
      const openCount = await db.select({ count: sql<number>`count(*)::int` })
        .from(ticketsTable)
        .where(and(eq(ticketsTable.assignedTo, agent.id), sql`${ticketsTable.status} <> 'resolved'`));
      const rating = await db.select({ averageRating: sql<number | null>`round(avg(${ticketsTable.rating})::numeric, 1)` })
        .from(ticketsTable)
        .where(eq(ticketsTable.assignedTo, agent.id));
      return {
        ...agent,
        openTicketCount: openCount[0]?.count ?? 0,
        averageRating: rating[0]?.averageRating ?? null,
      };
    }));
    res.json({ success: true, message: "Agents fetched", data: agentsWithLoad });
  } catch (err) {
    req.log.error({ err }, "getAdminAgents error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

router.post("/admin/agents", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      res.status(400).json({ success: false, message: "Provide a name, valid email, and password of at least 8 characters" });
      return;
    }
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length) {
      res.status(409).json({ success: false, message: "Email already registered" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [agent] = await db.insert(usersTable).values({ name, email, passwordHash, role: "admin" })
      .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email });

    void writeAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      action: "agent_created",
      resourceType: "user",
      resourceId: agent.id,
      meta: { agentEmail: agent.email },
    });

    res.status(201).json({ success: true, message: "Agent created", data: { ...agent, openTicketCount: 0 } });
  } catch (err) {
    req.log.error({ err }, "createAgent error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// PATCH assign ticket to an agent
router.patch("/admin/tickets/:ticketId/assign", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const ticketId = String(req.params["ticketId"]);
    const { agentId } = req.body as { agentId?: string | null };

    const [updated] = await db
      .update(ticketsTable)
      .set({ assignedTo: agentId ?? null })
      .where(eq(ticketsTable.id, ticketId))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, message: "Ticket not found" });
      return;
    }

    const assignedAgent = agentId
      ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, agentId)).limit(1)
      : [];

    const [ticketWithUser] = await db
      .select({
        id: ticketsTable.id,
        userId: ticketsTable.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
        productName: ticketsTable.productName,
        description: ticketsTable.description,
        status: ticketsTable.status,
        priority: ticketsTable.priority,
        category: ticketsTable.category,
        assignedTo: ticketsTable.assignedTo,
        createdAt: ticketsTable.createdAt,
      })
      .from(ticketsTable)
      .innerJoin(usersTable, eq(ticketsTable.userId, usersTable.id))
      .where(eq(ticketsTable.id, ticketId))
      .limit(1);

    const replies = await db.select().from(ticketRepliesTable).where(eq(ticketRepliesTable.ticketId, ticketId)).orderBy(ticketRepliesTable.createdAt);
    const attachments = await db.select().from(attachmentsTable).where(eq(attachmentsTable.ticketId, ticketId)).orderBy(attachmentsTable.createdAt);

    void writeAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      action: "ticket_assigned",
      resourceType: "ticket",
      resourceId: ticketId,
      meta: { assignedTo: agentId ?? null, agentName: assignedAgent[0]?.name ?? null },
    });

    res.json({
      success: true,
      message: "Ticket assigned",
      data: {
        ...ticketWithUser,
        assignedToName: assignedAgent[0]?.name ?? null,
        replies,
        attachments,
      },
    });
  } catch (err) {
    req.log.error({ err }, "assignTicket error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// GET replies for a ticket
router.get("/admin/tickets/:ticketId/replies", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const ticketId = String(req.params["ticketId"]);
    const replies = await db
      .select()
      .from(ticketRepliesTable)
      .where(eq(ticketRepliesTable.ticketId, ticketId))
      .orderBy(ticketRepliesTable.createdAt);

    res.json({ success: true, message: "Replies fetched", data: replies });
  } catch (err) {
    req.log.error({ err }, "getTicketReplies error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// POST admin reply to a ticket
router.post("/admin/tickets/:ticketId/replies", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const ticketId = String(req.params["ticketId"]);
    const { message } = req.body as { message?: string };

    if (!message || message.trim().length === 0) {
      res.status(400).json({ success: false, message: "Message is required" });
      return;
    }

    const ticketWithUser = await db
      .select({
        id: ticketsTable.id,
        userId: ticketsTable.userId,
        userEmail: usersTable.email,
        productName: ticketsTable.productName,
      })
      .from(ticketsTable)
      .innerJoin(usersTable, eq(ticketsTable.userId, usersTable.id))
      .where(eq(ticketsTable.id, ticketId))
      .limit(1);

    if (ticketWithUser.length === 0) {
      res.status(404).json({ success: false, message: "Ticket not found" });
      return;
    }

    const [reply] = await db
      .insert(ticketRepliesTable)
      .values({
        ticketId,
        authorId: req.user!.userId,
        authorName: "Admin",
        authorRole: "admin",
        message: message.trim(),
      })
      .returning();

    void writeAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      action: "admin_reply",
      resourceType: "ticket",
      resourceId: ticketId,
    });

    const t = ticketWithUser[0]!;
    void sendAdminReplyEmail({
      userEmail: t.userEmail,
      ticketId,
      productName: t.productName,
      replyMessage: message.trim(),
    });
    const [recipient] = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, ticketWithUser[0]!.userId)).limit(1);
    void sendTicketPush({
      pushToken: recipient?.pushToken ?? null,
      title: "New reply from SupportDesk",
      body: message.trim().slice(0, 120),
      ticketId,
    });

    res.status(201).json({ success: true, message: "Reply posted", data: reply });
  } catch (err) {
    req.log.error({ err }, "createTicketReply error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// GET /admin/audit-logs — paginated audit log (admin only)
router.get("/admin/audit-logs", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const parsedQuery = parseAuditLogQuery(req.query as Record<string, unknown>);
    if (!parsedQuery.ok) {
      res.status(400).json({ success: false, message: parsedQuery.message });
      return;
    }
    const { page, pageSize, action, resourceType, actorId } = parsedQuery.value;

    const filters: SQL[] = [];
    if (action) filters.push(eq(auditLogsTable.action, action));
    if (resourceType) filters.push(eq(auditLogsTable.resourceType, resourceType));
    if (actorId) filters.push(eq(auditLogsTable.actorId, actorId));

    const logs = await db
      .select()
      .from(auditLogsTable)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    res.json({ success: true, message: "Audit logs fetched", data: logs });
  } catch (err) {
    req.log.error({ err }, "getAuditLogs error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

export default router;
