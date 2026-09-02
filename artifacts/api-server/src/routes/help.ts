import { Router, type IRouter } from "express";
import { db, helpArticlesTable } from "@workspace/db";
import { ilike, or, eq } from "drizzle-orm";

const router: IRouter = Router();

// GET /help/articles — searchable, filterable list
router.get("/help/articles", async (req, res) => {
  try {
    const search = String(req.query["search"] ?? "").trim();
    const category = String(req.query["category"] ?? "").trim();

    let rows;

    if (search) {
      rows = await db
        .select()
        .from(helpArticlesTable)
        .where(
          or(
            ilike(helpArticlesTable.title, `%${search}%`),
            ilike(helpArticlesTable.body, `%${search}%`),
            ilike(helpArticlesTable.tags, `%${search}%`),
          ),
        )
        .limit(50);
    } else if (category && ["bug", "feature", "billing", "account", "other", "general"].includes(category)) {
      rows = await db
        .select()
        .from(helpArticlesTable)
        .where(eq(helpArticlesTable.category, category as "bug" | "feature" | "billing" | "account" | "other" | "general"))
        .limit(50);
    } else {
      rows = await db.select().from(helpArticlesTable).limit(50);
    }

    res.json({ success: true, message: "Help articles fetched", data: rows });
  } catch (err) {
    req.log.error({ err }, "getHelpArticles error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// GET /help/articles/suggested — return articles matching a category (falls back to general)
router.get("/help/articles/suggested", async (req, res) => {
  try {
    const category = String(req.query["category"] ?? "").trim();

    let rows;
    if (category && ["bug", "feature", "billing", "account", "other"].includes(category)) {
      rows = await db
        .select()
        .from(helpArticlesTable)
        .where(
          or(
            eq(helpArticlesTable.category, category as "bug" | "feature" | "billing" | "account" | "other"),
            eq(helpArticlesTable.category, "general"),
          ),
        )
        .limit(5);
    } else {
      rows = await db
        .select()
        .from(helpArticlesTable)
        .where(eq(helpArticlesTable.category, "general"))
        .limit(5);
    }

    res.json({ success: true, message: "Suggested articles fetched", data: rows });
  } catch (err) {
    req.log.error({ err }, "getSuggestedArticles error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// GET /help/articles/:slug — single article by slug
router.get("/help/articles/:slug", async (req, res) => {
  try {
    const slug = String(req.params["slug"]);
    const [article] = await db
      .select()
      .from(helpArticlesTable)
      .where(eq(helpArticlesTable.slug, slug))
      .limit(1);

    if (!article) {
      res.status(404).json({ success: false, message: "Article not found" });
      return;
    }

    res.json({ success: true, message: "Article fetched", data: article });
  } catch (err) {
    req.log.error({ err }, "getHelpArticle error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

export default router;
