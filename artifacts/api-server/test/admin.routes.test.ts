import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  select: vi.fn(),
  execute: vi.fn(),
  results: [] as unknown[][],
  executeResults: [] as unknown[][],
  tables: {
    tickets: {
      id: { name: "tickets.id" },
      productName: { name: "tickets.productName" },
      status: { name: "tickets.status" },
      priority: { name: "tickets.priority" },
      category: { name: "tickets.category" },
      assignedTo: { name: "tickets.assignedTo" },
      rating: { name: "tickets.rating" },
      feedbackText: { name: "tickets.feedbackText" },
      resolvedAt: { name: "tickets.resolvedAt" },
      createdAt: { name: "tickets.createdAt" },
    },
    users: {
      id: { name: "users.id" },
      name: { name: "users.name" },
      sessionVersion: { name: "users.sessionVersion" },
    },
    replies: {},
    attachments: {},
    auditLogs: {},
    userProducts: {},
  },
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: state.select,
    execute: state.execute,
    insert: vi.fn(),
    update: vi.fn(),
  },
  ticketsTable: state.tables.tickets,
  usersTable: state.tables.users,
  ticketRepliesTable: state.tables.replies,
  attachmentsTable: state.tables.attachments,
  auditLogsTable: state.tables.auditLogs,
  userProductsTable: state.tables.userProducts,
}));

vi.mock("drizzle-orm", () => ({
  eq: (...args: unknown[]) => ({ operator: "eq", args }),
  desc: (value: unknown) => ({ operator: "desc", value }),
  and: (...args: unknown[]) => ({ operator: "and", args }),
  gte: (...args: unknown[]) => ({ operator: "gte", args }),
  lte: (...args: unknown[]) => ({ operator: "lte", args }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));

vi.mock("../src/lib/audit", () => ({ writeAudit: vi.fn() }));

import adminRouter from "../src/routes/admin";

function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const returnChain = () => chain;
  chain["from"] = vi.fn(returnChain);
  chain["innerJoin"] = vi.fn(returnChain);
  chain["where"] = vi.fn(returnChain);
  chain["groupBy"] = vi.fn(returnChain);
  chain["orderBy"] = vi.fn(returnChain);
  chain["limit"] = vi.fn(returnChain);
  chain["then"] = (onFulfilled: (value: unknown[]) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(rows).then(onFulfilled, onRejected);
  return chain;
}

function adminToken() {
  return jwt.sign(
    { userId: "admin-1", email: "admin@example.com", role: "admin", sessionVersion: 0 },
    process.env["SESSION_SECRET"]!,
    { expiresIn: "1h" },
  );
}

function testApp() {
  const app = express();
  app.use(express.json());
  app.use(adminRouter);
  return app;
}

beforeEach(() => {
  state.results = [];
  state.executeResults = [];
  state.select.mockImplementation(() => selectChain(state.results.shift() ?? []));
  state.execute.mockImplementation(() => Promise.resolve({ rows: state.executeResults.shift() ?? [] }));
});

describe("admin analytics", () => {
  it("returns organization-wide ratings, a full distribution, and bounded written feedback", async () => {
    state.results = [
      [{ sessionVersion: 0 }],
      [
        {
          id: "ticket-older",
          productName: "Printer",
          status: "resolved",
          priority: "high",
          category: "bug",
          rating: 2,
          feedbackText: "Still slow",
          resolvedAt: new Date("2024-01-10T12:00:00.000Z"),
          createdAt: new Date("2024-01-09T12:00:00.000Z"),
        },
        {
          id: "ticket-newer",
          productName: "Billing portal",
          status: "resolved",
          priority: "medium",
          category: "billing",
          rating: 5,
          feedbackText: "Solved quickly",
          resolvedAt: new Date("2024-01-12T12:00:00.000Z"),
          createdAt: new Date("2024-01-11T12:00:00.000Z"),
        },
        {
          id: "ticket-unrated",
          productName: "Workspace",
          status: "open",
          priority: "low",
          category: "feature",
          rating: null,
          feedbackText: null,
          resolvedAt: null,
          createdAt: new Date("2024-01-13T12:00:00.000Z"),
        },
      ],
      [],
    ];
    state.executeResults = [[], []];

    const response = await request(testApp())
      .get("/admin/analytics")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data.satisfaction).toEqual({
      ratedTicketCount: 2,
      averageRating: 3.5,
      distribution: [
        { rating: 1, count: 0 },
        { rating: 2, count: 1 },
        { rating: 3, count: 0 },
        { rating: 4, count: 0 },
        { rating: 5, count: 1 },
      ],
      recentFeedback: expect.arrayContaining([
        expect.objectContaining({ ticketId: "ticket-newer", feedbackText: "Solved quickly" }),
        expect.objectContaining({ ticketId: "ticket-older", feedbackText: "Still slow" }),
      ]),
    });
    expect(response.body.data.satisfaction.recentFeedback.map((feedback: { ticketId: string }) => feedback.ticketId))
      .toEqual(["ticket-newer", "ticket-older"]);
  });
});