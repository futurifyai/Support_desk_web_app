import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const helpArticlesTable = pgTable("help_articles", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull().$type<"bug" | "feature" | "billing" | "account" | "other" | "general">(),
  tags: text("tags").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type HelpArticle = typeof helpArticlesTable.$inferSelect;
