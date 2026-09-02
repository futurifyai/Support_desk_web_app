import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

type RateLimitOptions = {
  namespace: string;
  windowMs: number;
  max: number;
  identifier?: (req: Request) => string;
};

export type RateLimitConsumption = {
  count: number;
  resetAt: Date;
};

export type RateLimitConsumer = (key: string, windowMs: number) => Promise<RateLimitConsumption>;

export function hashRateLimitIdentifier(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function consumeDatabaseRateLimit(key: string, windowMs: number): Promise<RateLimitConsumption> {
  const now = new Date();
  const expiredBefore = new Date(now.getTime() - windowMs);
  const result = await db.execute(sql`
    INSERT INTO api_rate_limits (key, window_started_at, request_count, updated_at)
    VALUES (${key}, ${now}, 1, ${now})
    ON CONFLICT (key) DO UPDATE SET
      request_count = CASE
        WHEN api_rate_limits.window_started_at <= ${expiredBefore} THEN 1
        ELSE api_rate_limits.request_count + 1
      END,
      window_started_at = CASE
        WHEN api_rate_limits.window_started_at <= ${expiredBefore} THEN ${now}
        ELSE api_rate_limits.window_started_at
      END,
      updated_at = ${now}
    RETURNING request_count, window_started_at
  `);
  const rows = Array.isArray(result)
    ? result
    : "rows" in result
      ? result.rows
      : [];
  const row = rows[0] as { request_count?: number; window_started_at?: Date | string } | undefined;
  if (!row?.request_count || !row.window_started_at) {
    throw new Error("Rate limit counter did not return a result");
  }
  const windowStartedAt = row.window_started_at instanceof Date ? row.window_started_at : new Date(row.window_started_at);
  return { count: Number(row.request_count), resetAt: new Date(windowStartedAt.getTime() + windowMs) };
}

export function createRateLimiter(
  { namespace, windowMs, max, identifier = (req) => req.ip ?? req.socket.remoteAddress ?? "unknown" }: RateLimitOptions,
  consume: RateLimitConsumer = consumeDatabaseRateLimit,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawIdentifier = identifier(req);
      const key = `${namespace}:${hashRateLimitIdentifier(rawIdentifier)}`;
      const result = await consume(key, windowMs);
      if (result.count > max) {
        const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
        res.setHeader("Retry-After", retryAfterSeconds);
        res.status(429).json({ success: false, message: "Too many requests. Please try again later." });
        return;
      }
      next();
    } catch (err) {
      req.log?.error({ err }, "Rate limit check failed");
      res.status(503).json({ success: false, message: "Service temporarily unavailable. Please try again shortly." });
    }
  };
}