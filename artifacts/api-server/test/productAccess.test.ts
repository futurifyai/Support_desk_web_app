import { beforeEach, describe, expect, it, vi } from "vitest";

const auditState = vi.hoisted(() => ({ writeAudit: vi.fn() }));
const state = vi.hoisted(() => ({
  update: vi.fn(),
  updateResults: [] as unknown[][],
  setCalls: [] as unknown[],
  table: {
    id: { name: "user_products.id" },
    status: { name: "user_products.status" },
    endDate: { name: "user_products.endDate" },
  },
}));

function updateChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain["set"] = vi.fn((value) => { state.setCalls.push(value); return chain; });
  chain["where"] = vi.fn(() => chain);
  chain["returning"] = vi.fn(() => Promise.resolve(rows));
  return chain;
}

vi.mock("@workspace/db", () => ({
  db: { update: state.update },
  userProductsTable: state.table,
}));
vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ operator: "and", args }),
  eq: (...args: unknown[]) => ({ operator: "eq", args }),
  gt: (...args: unknown[]) => ({ operator: "gt", args }),
  isNull: (value: unknown) => ({ operator: "isNull", value }),
  lt: (...args: unknown[]) => ({ operator: "lt", args }),
  lte: (...args: unknown[]) => ({ operator: "lte", args }),
  or: (...args: unknown[]) => ({ operator: "or", args }),
}));
vi.mock("../src/lib/audit", () => auditState);

import { autoExpireIfNeeded } from "../src/lib/productAccess";

beforeEach(() => {
  state.updateResults = [];
  state.setCalls = [];
  state.update.mockImplementation(() => updateChain(state.updateResults.shift() ?? []));
  auditState.writeAudit.mockReset();
});

describe("product access expiry", () => {
  it("persists an expired status and writes an audit event for a past-due approved product", async () => {
    const now = new Date("2026-08-26T10:00:00.000Z");
    const product = {
      id: "product-1",
      userId: "user-1",
      productName: "Workspace Pro",
      status: "approved",
      startDate: null,
      endDate: new Date("2026-08-25T23:59:59.999Z"),
      approvedBy: "admin-1",
      approvedAt: new Date("2026-08-01T00:00:00.000Z"),
      expiredAt: null,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    };
    const expired = { ...product, status: "expired", expiredAt: now };
    state.updateResults = [[expired]];

    const result = await autoExpireIfNeeded(product as never, now);

    expect(result).toEqual(expired);
    expect(state.setCalls).toContainEqual({ status: "expired", expiredAt: now });
    expect(auditState.writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "product_access_expired",
      resourceId: "product-1",
    }));
  });

  it("does not update access that is already expired or remains within its end date", async () => {
    const now = new Date("2026-08-26T10:00:00.000Z");
    const product = {
      id: "product-1",
      userId: "user-1",
      productName: "Workspace Pro",
      status: "expired",
      startDate: null,
      endDate: new Date("2026-08-25T23:59:59.999Z"),
      approvedBy: "admin-1",
      approvedAt: new Date(),
      expiredAt: now,
      createdAt: new Date(),
    };

    await expect(autoExpireIfNeeded(product as never, now)).resolves.toEqual(product);
    expect(state.update).not.toHaveBeenCalled();
  });
});