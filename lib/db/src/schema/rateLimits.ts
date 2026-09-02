import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const rateLimitsTable = pgTable("api_rate_limits", {
  key: text("key").primaryKey(),
  windowStartedAt: timestamp("window_started_at").notNull(),
  requestCount: integer("request_count").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type RateLimit = typeof rateLimitsTable.$inferSelect;