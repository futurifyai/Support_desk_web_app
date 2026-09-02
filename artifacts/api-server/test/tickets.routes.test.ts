import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  results: [] as unknown[][],
  updateResults: [] as unknown[][],
  eqCalls: [] as unknown[][],
  lteCalls: [] as unknown[][],
  tables: {
    tickets: {
      name: "tickets",
      id: { name: "tickets.id" },
      userId: { name: "tickets.userId" },
      productName: { name: "tickets.productName" },
      description: { name: "tickets.description" },
      status: { name: "tickets.status" },
      priority: { name: "tickets.priority" },
      category: { name: "tickets.category" },
      rating: { name: "tickets.rating" },
      createdAt: { name: "tickets.createdAt" },
      resolvedAt: { name: "tickets.resolvedAt" },
    },
    users: { name: "users", sessionVersion: { name: "users.sessionVersion" } },
    replies: { name: "ticket_replies" },
    attachments: { name: "attachments" },
    userProducts: {
      name: "user_products",
      id: { name: "user_products.id" },
      userId: { name: "user_products.userId" },
      productName: { name: "user_products.productName" },
      status: { name: "user_products.status" },
      startDate: { name: "user_products.startDate" },
      endDate: { name: "user_products.endDate" },
    },
  },
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: state.select,
    insert: vi.fn(),
    update: state.update,
  },
  ticketsTable: state.tables.tickets,
  usersTable: state.tables.users,
  ticketRepliesTable: state.tables.replies,
  attachmentsTable: state.tables.attachments,
  userProductsTable: state.tables.userProducts,
}));

vi.mock("drizzle-orm", () => ({
  eq: (...args: unknown[]) => {
    state.eqCalls.push(args);
    return { operator: "eq", args };
  },
  desc: (value: unknown) => ({ operator: "desc", value }),
  and: (...args: unknown[]) => ({ operator: "and", args }),
  ilike: (...args: unknown[]) => ({ operator: "ilike", args }),
  or: (...args: unknown[]) => ({ operator: "or", args }),
  gte: (...args: unknown[]) => ({ operator: "gte", args }),
  lt: (...args: unknown[]) => ({ operator: "lt", args }),
  gt: (...args: unknown[]) => ({ operator: "gt", args }),
  lte: (...args: unknown[]) => { state.lteCalls.push(args); return { operator: "lte", args }; },
  isNotNull: (value: unknown) => ({ operator: "isNotNull", value }),
  isNull: (value: unknown) => ({ operator: "isNull", value }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));

vi.mock("../src/lib/email", () => ({
  sendTicketReceivedEmail: vi.fn(),
  sendUserReplyEmail: vi.fn(),
}));
vi.mock("../src/lib/push", () => ({ sendTicketPush: vi.fn() }));
vi.mock("../src/lib/audit", () => ({ writeAudit: vi.fn() }));

import ticketsRouter from "../src/routes/tickets";

function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const returnChain = () => chain;
  chain["from"] = vi.fn(returnChain);
  chain["where"] = vi.fn(returnChain);
  chain["orderBy"] = vi.fn(returnChain);
  chain["limit"] = vi.fn(returnChain);
  chain["offset"] = vi.fn(returnChain);
  chain["then"] = (onFulfilled: (value: unknown[]) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(rows).then(onFulfilled, onRejected);
  return chain;
}

function updateChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain["set"] = vi.fn(() => chain);
  chain["where"] = vi.fn(() => chain);
  chain["returning"] = vi.fn(() => Promise.resolve(rows));
  return chain;
}

function userToken(role: "user" | "admin" = "user") {
  return jwt.sign(
    { userId: "user-1", email: "person@example.com", role, sessionVersion: 0 },
    process.env["SESSION_SECRET"]!,
    { expiresIn: "1h" },
  );
}

function testApp() {
  const app = express();
  app.use(express.json());
  app.use(ticketsRouter);
  return app;
}

beforeEach(() => {
  state.results = [];
  state.updateResults = [];
  state.eqCalls = [];
  state.lteCalls = [];
  state.select.mockImplementation(() => selectChain(state.results.shift() ?? []));
  state.update.mockImplementation(() => updateChain(state.updateResults.shift() ?? []));
});

describe("customer ticket routes", () => {
  it("prevents ticket creation before a future product grant starts", async () => {
    state.results = [
      [{ sessionVersion: 0 }],
      [{
        id: "product-future",
        userId: "user-1",
        productName: "Workspace Pro",
        status: "approved",
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: null,
        approvedBy: "admin-1",
        approvedAt: new Date(),
        expiredAt: null,
        createdAt: new Date(),
      }],
    ];

    const response = await request(testApp())
      .post("/tickets")
      .set("Authorization", `Bearer ${userToken()}`)
      .send({ productName: "Workspace Pro", description: "The product cannot be opened from my dashboard." });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: "You do not have approved access to this product",
    });
    expect(state.eqCalls).toContainEqual([state.tables.userProducts.userId, "user-1"]);
    expect(state.eqCalls).toContainEqual([state.tables.userProducts.userId, "user-1"]);
    expect(state.eqCalls).toContainEqual([state.tables.userProducts.productName, "Workspace Pro"]);
  });

  it("expires stale approved product access before it can authorize a ticket", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    state.results = [
      [{ sessionVersion: 0 }],
      [{
        id: "product-1",
        userId: "user-1",
        productName: "Workspace Pro",
        status: "approved",
        startDate: null,
        endDate: yesterday,
        approvedBy: "admin-1",
        approvedAt: new Date(),
        expiredAt: null,
        createdAt: new Date(),
      }],
    ];
    state.updateResults = [[{
      id: "product-1",
      userId: "user-1",
      productName: "Workspace Pro",
      status: "expired",
      startDate: null,
      endDate: yesterday,
      approvedBy: "admin-1",
      approvedAt: new Date(),
      expiredAt: new Date(),
      createdAt: new Date(),
    }]];

    const response = await request(testApp())
      .post("/tickets")
      .set("Authorization", `Bearer ${userToken()}`)
      .send({ productName: "Workspace Pro", description: "The product cannot be opened from my dashboard." });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: "You do not have approved access to this product",
    });
    expect(state.update).toHaveBeenCalledTimes(1);
  });

  it("scopes ticket history to the authenticated user and returns pagination metadata", async () => {
    state.results = [
      [{ sessionVersion: 0 }],
      [{
        id: "ticket-1",
        userId: "user-1",
        productName: "Printer",
        description: "The office printer does not connect.",
        status: "open",
        priority: "high",
        category: "bug",
        createdAt: new Date("2024-01-10T12:00:00.000Z"),
      }],
      [{ total: 1 }],
    ];

    const response = await request(testApp())
      .get("/tickets?page=1&pageSize=30&search=printer")
      .set("Authorization", `Bearer ${userToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ page: 1, pageSize: 30, total: 1, totalPages: 1 });
    expect(response.body.data).toHaveLength(1);
    expect(state.eqCalls).toContainEqual([state.tables.tickets.userId, "user-1"]);
  });

  it("denies a user trying to view another customer's ticket", async () => {
    state.results = [
      [{ sessionVersion: 0 }],
      [{ id: "ticket-2", userId: "user-2" }],
    ];

    const response = await request(testApp())
      .get("/tickets/ticket-2")
      .set("Authorization", `Bearer ${userToken()}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ success: false, message: "Not authorized" });
  });

  it("returns only the authenticated user's satisfaction aggregate", async () => {
    state.results = [
      [{ sessionVersion: 0 }],
      [
        {
          id: "ticket-1",
          productName: "Printer",
          rating: 5,
          feedbackText: "Solved quickly",
          resolvedAt: new Date("2024-01-11T12:00:00.000Z"),
          createdAt: new Date("2024-01-10T12:00:00.000Z"),
        },
        {
          id: "ticket-3",
          productName: "Billing portal",
          rating: 3,
          feedbackText: null,
          resolvedAt: new Date("2024-01-12T12:00:00.000Z"),
          createdAt: new Date("2024-01-10T12:00:00.000Z"),
        },
      ],
    ];

    const response = await request(testApp())
      .get("/tickets/satisfaction")
      .set("Authorization", `Bearer ${userToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      ratedTicketCount: 2,
      averageRating: 4,
      distribution: [
        { rating: 1, count: 0 },
        { rating: 2, count: 0 },
        { rating: 3, count: 1 },
        { rating: 4, count: 0 },
        { rating: 5, count: 1 },
      ],
      recentFeedback: [{ ticketId: "ticket-1", feedbackText: "Solved quickly" }],
    });
    expect(state.eqCalls).toContainEqual([state.tables.tickets.userId, "user-1"]);
  });
});