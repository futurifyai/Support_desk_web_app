import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, userProductsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { autoExpireIfNeeded, isActiveProductAccess } from "../lib/productAccess";

const router: IRouter = Router();

router.get("/users/me/products", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const products = await db
      .select()
      .from(userProductsTable)
      .where(eq(userProductsTable.userId, req.user!.userId))
      .orderBy(desc(userProductsTable.createdAt));
    const refreshedProducts = await Promise.all(products.map((product) => autoExpireIfNeeded(product)));
    res.json({
      success: true,
      message: "Product access fetched",
      data: refreshedProducts.filter((product) => isActiveProductAccess(product)),
    });
  } catch (err) {
    req.log.error({ err }, "getMyProducts error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

export default router;