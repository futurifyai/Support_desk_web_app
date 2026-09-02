import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  select: vi.fn(),
  results: [] as unknown[][],
  usersTable: { name: "users", id: { name: "users.id" }, sessionVersion: { name: "users.sessionVersion" } },
}));

vi.mock("@workspace/db", () => ({
  db: { select: state.select },
  usersTable: state.usersTable,
}));

vi.mock("drizzle-orm", () => ({
  eq: (...args: unknown[]) => ({ operator: "eq", args }),
}));

import { requireAdmin } from "../src/middlewares/auth";

function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const returnChain = () => chain;
  chain["from"] = vi.fn(returnChain);
  chain["where"] = vi.fn(returnChain);
  chain["limit"] = vi.fn(returnChain);
  chain["then"] = (onFulfilled: (value: unknown[]) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(rows).then(onFulfilled, onRejected);
  return chain;
}

function token(role: "user" | "admin", sessionVersion = 0) {
  return jwt.sign(
    { userId: "user-1", email: "person@example.com", role, sessionVersion },
    process.env["SESSION_SECRET"]!,
    { expiresIn: "1h" },
  );
}

beforeEach(() => {
  state.results = [];
  state.select.mockImplementation(() => selectChain(state.results.shift() ?? []));
});

describe("requireAdmin", () => {
  it("rejects an authenticated customer from an admin-only route", async () => {
    state.results = [[{ sessionVersion: 0 }]];
    const app = express();
    app.get("/admin-only", requireAdmin, (_req, res) => res.json({ success: true }));

    const response = await request(app).get("/admin-only").set("Authorization", `Bearer ${token("user")}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ success: false, message: "Admin access required" });
  });

  it("rejects a token invalidated by a password or session change", async () => {
    state.results = [[{ sessionVersion: 1 }]];
    const app = express();
    app.get("/admin-only", requireAdmin, (_req, res) => res.json({ success: true }));

    const response = await request(app).get("/admin-only").set("Authorization", `Bearer ${token("admin", 0)}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, message: "Session expired. Please sign in again." });
  });
});