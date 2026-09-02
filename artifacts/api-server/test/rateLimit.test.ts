import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createRateLimiter, hashRateLimitIdentifier } from "../src/lib/rateLimit";

describe("createRateLimiter", () => {
  it("returns a retryable 429 after the configured limit", async () => {
    const app = express();
    let count = 0;
    app.use(createRateLimiter(
      { namespace: "test", windowMs: 60_000, max: 2 },
      async () => ({ count: ++count, resetAt: new Date(Date.now() + 60_000) }),
    ));
    app.get("/", (_req, res) => res.json({ success: true }));

    expect((await request(app).get("/")).status).toBe(200);
    expect((await request(app).get("/")).status).toBe(200);
    const limited = await request(app).get("/");

    expect(limited.status).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
    expect(limited.body).toEqual({
      success: false,
      message: "Too many requests. Please try again later.",
    });
  });

  it("hashes client identifiers before they are persisted", () => {
    expect(hashRateLimitIdentifier("203.0.113.9")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRateLimitIdentifier("203.0.113.9")).not.toContain("203.0.113.9");
  });
});