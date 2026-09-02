import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { ticketsTable } from "./tickets";

export const ticketRepliesTable = pgTable("ticket_replies", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ticketId: text("ticket_id")
    .notNull()
    .references(() => ticketsTable.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  authorRole: text("author_role").notNull().$type<"admin" | "user">(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTicketReplySchema = createInsertSchema(ticketRepliesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTicketReply = z.infer<typeof insertTicketReplySchema>;
export type TicketReply = typeof ticketRepliesTable.$inferSelect;
