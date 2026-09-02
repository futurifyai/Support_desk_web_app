import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const userProductsTable = pgTable("user_products", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status")
    .notNull()
    .default("pending")
    .$type<"pending" | "approved" | "disapproved" | "expired">(),
  approvedBy: text("approved_by").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  expiredAt: timestamp("expired_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserProductSchema = createInsertSchema(userProductsTable).omit({
  id: true,
  approvedBy: true,
  approvedAt: true,
  createdAt: true,
});

export type InsertUserProduct = z.infer<typeof insertUserProductSchema>;
export type UserProduct = typeof userProductsTable.$inferSelect;