import { and, eq, lt } from "drizzle-orm";
import { db, ticketRepliesTable, ticketsTable, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { sendTicketPush } from "../lib/push";

async function escalateOverdueTickets(): Promise<void> {
  const overdue = await db.select().from(ticketsTable).where(and(
    lt(ticketsTable.slaDueAt, new Date()),
    eq(ticketsTable.slaEscalated, false),
  )).limit(100);

  for (const ticket of overdue) {
    if (ticket.status === "resolved") continue;
    const replies = await db.select({ id: ticketRepliesTable.id })
      .from(ticketRepliesTable)
      .where(eq(ticketRepliesTable.ticketId, ticket.id))
      .limit(1);
    if (replies.length > 0) continue;

    await db.update(ticketsTable)
      .set({
        slaEscalated: true,
        priority: ticket.priority === "critical" ? "critical" : "critical",
      })
      .where(eq(ticketsTable.id, ticket.id));

    const admins = await db.select({ pushToken: usersTable.pushToken })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"))
      .limit(100);
    await Promise.all(admins.map((admin) => sendTicketPush({
      pushToken: admin.pushToken,
      title: "SLA breach",
      body: `${ticket.productName} is overdue and was escalated`,
      ticketId: ticket.id,
    })));
  }
}

export function startSlaScheduler(): void {
  const run = () => void escalateOverdueTickets().catch((err) => logger.error({ err }, "SLA escalation failed"));
  run();
  setInterval(run, 15 * 60 * 1000).unref();
}