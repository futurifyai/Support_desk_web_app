import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateProductDateRange } from "../src/lib/userProductValidation";

const auditState = vi.hoisted(() => ({ writeAudit: vi.fn() }));
const state = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  selectResults: [] as unknown[][],
  insertResults: [] as unknown[][],
  updateResults: [] as unknown[][],
  deleteResults: [] as unknown[][],
  setCalls: [] as unknown[],
  tables: {
    users: {
      id: { name: "users.id" }, name: { name: "users.name" }, email: { name: "users.email" },
      role: { name: "users.role" }, createdAt: { name: "users.createdAt" },
      sessionVersion: { name: "users.sessionVersion" }, pushToken: { name: "users.pushToken" },
    },
    products: {
      id: { name: "user_products.id" }, userId: { name: "user_products.userId" },
      productName: { name: "user_products.productName" }, status: { name: "user_products.status" },
      startDate: { name: "user_products.startDate" }, endDate: { name: "user_products.endDate" },
      approvedBy: { name: "user_products.approvedBy" }, approvedAt: { name: "user_products.approvedAt" },
      expiredAt: { name: "user_products.expiredAt" },
      createdAt: { name: "user_products.createdAt" },
    },
  },
}));

function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const returnChain = () => chain;
  chain["from"] = vi.fn(returnChain);
  chain["where"] = vi.fn(returnChain);
  chain["orderBy"] = vi.fn(returnChain);
  chain["groupBy"] = vi.fn(returnChain);
  chain["limit"] = vi.fn(returnChain);
  chain["offset"] = vi.fn(returnChain);
  chain["then"] = (onFulfilled: (value: unknown[]) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(rows).then(onFulfilled, onRejected);
  return chain;
}

function mutationChain(rows: unknown[], onSet?: (value: unknown) => void) {
  const chain: Record<string, unknown> = {};
  chain["values"] = vi.fn(() => chain);
  chain["set"] = vi.fn((value) => { onSet?.(value); return chain; });
  chain["where"] = vi.fn(() => chain);
  chain["returning"] = vi.fn(() => Promise.resolve(rows));
  return chain;
}

vi.mock("@workspace/db", () => ({
  db: { select: state.select, insert: state.insert, update: state.update, delete: state.delete },
  usersTable: state.tables.users,
  userProductsTable: state.tables.products,
  ticketsTable: {}, ticketRepliesTable: {}, attachmentsTable: {}, auditLogsTable: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: (...args: unknown[]) => ({ operator: "eq", args }),
  and: (...args: unknown[]) => ({ operator: "and", args }),
  or: (...args: unknown[]) => ({ operator: "or", args }),
  asc: (value: unknown) => ({ operator: "asc", value }),
  desc: (value: unknown) => ({ operator: "desc", value }),
  ilike: (...args: unknown[]) => ({ operator: "ilike", args }),
  gte: (...args: unknown[]) => ({ operator: "gte", args }),
  lte: (...args: unknown[]) => ({ operator: "lte", args }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));
vi.mock("../src/lib/audit", () => auditState);
vi.mock("../src/lib/email", () => ({ sendAdminReplyEmail: vi.fn() }));
vi.mock("../src/lib/push", () => ({ sendTicketPush: vi.fn() }));

import adminRouter from "../src/routes/admin";

function token(role: "admin" | "user" = "admin") {
  return jwt.sign(
    { userId: role === "admin" ? "admin-1" : "user-1", email: `${role}@example.com`, role, sessionVersion: 0 },
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
  state.selectResults = [];
  state.insertResults = [];
  state.updateResults = [];
  state.deleteResults = [];
  state.setCalls = [];
  auditState.writeAudit.mockReset();
  state.select.mockImplementation(() => selectChain(state.selectResults.shift() ?? []));
  state.insert.mockImplementation(() => mutationChain(state.insertResults.shift() ?? []));
  state.update.mockImplementation(() => mutationChain(state.updateResults.shift() ?? [], (value) => state.setCalls.push(value)));
  state.delete.mockImplementation(() => mutationChain(state.deleteResults.shift() ?? []));
});

describe("admin product access routes", () => {
  it("rejects a non-admin before allowing product access management", async () => {
    state.selectResults = [[{ sessionVersion: 0 }]];
    const response = await request(testApp())
      .get("/admin/users/user-1/products")
      .set("Authorization", `Bearer ${token("user")}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ success: false, message: "Admin access required" });
  });

  it("creates pending product access for an existing user", async () => {
    state.selectResults = [
      [{ sessionVersion: 0 }],
      [{ id: "user-1", role: "user" }],
    ];
    state.insertResults = [[{
      id: "product-1", userId: "user-1", productName: "Workspace Pro", status: "pending",
      startDate: null, endDate: null, approvedBy: null, approvedAt: null, createdAt: new Date(),
    }]];

    const response = await request(testApp())
      .post("/admin/users/user-1/products")
      .set("Authorization", `Bearer ${token()}`)
      .send({ productName: "Workspace Pro" });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ userId: "user-1", productName: "Workspace Pro", status: "pending" });
  });

  it("scopes an update to the specified user's product and records approval metadata", async () => {
    state.selectResults = [
      [{ sessionVersion: 0 }],
      [{
        id: "product-1", userId: "user-1", productName: "Workspace Pro", status: "pending",
        startDate: null, endDate: null,
      }],
    ];
    state.updateResults = [[{
      id: "product-1", userId: "user-1", productName: "Workspace Pro", status: "approved",
      startDate: null, endDate: null, approvedBy: "admin-1", approvedAt: new Date(), createdAt: new Date(),
    }]];

    const response = await request(testApp())
      .patch("/admin/users/user-1/products/product-1")
      .set("Authorization", `Bearer ${token()}`)
      .send({ status: "approved" });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: "approved", approvedBy: "admin-1" });
    expect(state.setCalls).toContainEqual(expect.objectContaining({ status: "approved", approvedBy: "admin-1" }));
  });

  it("does not mutate a product that is not owned by the requested user", async () => {
    state.selectResults = [[{ sessionVersion: 0 }], []];

    const response = await request(testApp())
      .patch("/admin/users/user-1/products/product-from-another-user")
      .set("Authorization", `Bearer ${token()}`)
      .send({ status: "approved" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ success: false, message: "Product access not found" });
    expect(state.update).not.toHaveBeenCalled();
  });

  it("records an audit entry when an admin updates only product dates", async () => {
    state.selectResults = [
      [{ sessionVersion: 0 }],
      [{
        id: "product-1", userId: "user-1", productName: "Workspace Pro", status: "approved",
        startDate: new Date("2026-08-01T00:00:00Z"), endDate: new Date("2026-08-20T23:59:59Z"),
      }],
    ];
    state.updateResults = [[{
      id: "product-1", userId: "user-1", productName: "Workspace Pro", status: "approved",
      startDate: new Date("2026-08-10T00:00:00Z"), endDate: new Date("2026-09-20T23:59:59Z"),
      approvedBy: "admin-1", approvedAt: new Date(), expiredAt: null, createdAt: new Date(),
    }]];

    const response = await request(testApp())
      .patch("/admin/users/user-1/products/product-1")
      .set("Authorization", `Bearer ${token()}`)
      .send({ startDate: "2026-08-10", endDate: "2026-09-20" });

    expect(response.status).toBe(200);
    expect(auditState.writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "product_access_dates_updated",
      resourceId: "product-1",
    }));
  });

  it("blocks re-approval when the product end date is already past", async () => {
    state.selectResults = [
      [{ sessionVersion: 0 }],
      [{
        id: "product-1", userId: "user-1", productName: "Workspace Pro", status: "expired",
        startDate: new Date("2025-01-01T00:00:00Z"), endDate: new Date("2025-01-02T23:59:59Z"),
      }],
    ];

    const response = await request(testApp())
      .patch("/admin/users/user-1/products/product-1")
      .set("Authorization", `Bearer ${token()}`)
      .send({ status: "approved" });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("end date in the past");
    expect(state.update).not.toHaveBeenCalled();
  });

  it("deletes only the matching user's product access", async () => {
    state.selectResults = [[{ sessionVersion: 0 }]];
    state.deleteResults = [[{ id: "product-1", productName: "Workspace Pro" }]];

    const response = await request(testApp())
      .delete("/admin/users/user-1/products/product-1")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ id: "product-1", productName: "Workspace Pro" });
  });

  it("requires an access end date to be after its start date", () => {
    expect(validateProductDateRange(new Date("2026-01-10T00:00:00Z"), new Date("2026-01-09T23:59:59Z")))
      .toBe("End date must be after the start date");
    expect(validateProductDateRange(new Date("2026-01-10T00:00:00Z"), new Date("2026-01-10T00:00:00Z")))
      .toBe("End date must be after the start date");
  });
});