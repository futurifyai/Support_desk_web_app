import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const ticketsTable = pgTable("tickets", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id),
  productName: text("product_name").notNull(),
  description: text("description").notNull(),
  status: text("status")
    .notNull()
    .default("open")
    .$type<"open" | "in-progress" | "resolved">(),
  priority: text("priority")
    .notNull()
    .default("medium")
    .$type<"low" | "medium" | "high" | "critical">(),
  category: text("category")
    .notNull()
    .default("other")
    .$type<"bug" | "feature" | "billing" | "account" | "other">(),
  assignedTo: text("assigned_to").references(() => usersTable.id),
  rating: integer("rating"),
  feedbackText: text("feedback_text"),
  slaDueAt: timestamp("sla_due_at"),
  slaEscalated: boolean("sla_escalated").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTicketSchema = createInsertSchema(ticketsTable).omit({
  id: true,
  slaDueAt: true,
  slaEscalated: true,
  resolvedAt: true,
  createdAt: true,
});
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof ticketsTable.$inferSelect;
