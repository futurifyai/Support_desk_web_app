import { and, eq, gt, isNull, lt, lte, or } from "drizzle-orm";
import { db, type UserProduct, userProductsTable } from "@workspace/db";
import { writeAudit } from "./audit";

/**
 * Product access that is safe to expose to a customer or use for ticket creation.
 * A null date represents an open-ended bound.
 */
export function activeProductAccessFilter(userId: string, productName?: string) {
  const now = new Date();
  return and(
    eq(userProductsTable.userId, userId),
    eq(userProductsTable.status, "approved"),
    or(isNull(userProductsTable.startDate), lte(userProductsTable.startDate, now)),
    or(isNull(userProductsTable.endDate), gt(userProductsTable.endDate, now)),
    ...(productName ? [eq(userProductsTable.productName, productName)] : []),
  );
}

export function isActiveProductAccess(product: UserProduct, now = new Date()): boolean {
  return product.status === "approved"
    && (!product.startDate || product.startDate <= now)
    && (!product.endDate || product.endDate > now);
}

/**
 * Persists expiry the first time a past-due approved product access becomes relevant.
 * The status predicate makes concurrent checks idempotent and prevents duplicate expiry audits.
 */
export async function autoExpireIfNeeded(product: UserProduct, now = new Date()): Promise<UserProduct> {
  if (product.status !== "approved" || !product.endDate || product.endDate >= now) {
    return product;
  }

  const [expired] = await db
    .update(userProductsTable)
    .set({ status: "expired", expiredAt: now })
    .where(and(
      eq(userProductsTable.id, product.id),
      eq(userProductsTable.status, "approved"),
    ))
    .returning();

  if (!expired) return product;

  void writeAudit({
    action: "product_access_expired",
    resourceType: "user_product",
    resourceId: expired.id,
    meta: {
      userId: expired.userId,
      productName: expired.productName,
      expiredAt: now.toISOString(),
      reason: "end_date_passed",
    },
  });
  return expired;
}

/** Expire all past-due approved rows, used by the hourly server sweep. */
export async function expireDueProductAccess(now = new Date()): Promise<number> {
  const expiredProducts = await db
    .update(userProductsTable)
    .set({ status: "expired", expiredAt: now })
    .where(and(
      eq(userProductsTable.status, "approved"),
      lt(userProductsTable.endDate, now),
    ))
    .returning();

  await Promise.all(expiredProducts.map((product) => writeAudit({
    action: "product_access_expired",
    resourceType: "user_product",
    resourceId: product.id,
    meta: {
      userId: product.userId,
      productName: product.productName,
      expiredAt: now.toISOString(),
      reason: "scheduled_end_date_sweep",
    },
  })));

  return expiredProducts.length;
}