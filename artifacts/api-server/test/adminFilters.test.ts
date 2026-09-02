import { describe, expect, it } from "vitest";
import { parseAdminTicketListQuery, parseAdminUserListQuery, parseAuditLogQuery } from "../src/lib/adminFilters";

describe("admin query parsers", () => {
  it("accepts bounded ticket list filters", () => {
    expect(parseAdminTicketListQuery({
      page: "2",
      pageSize: "50",
      search: "printer",
      status: "open",
      priority: "high",
      category: "bug",
      assignedTo: "agent_1",
      sort: "sla-soonest",
    })).toMatchObject({ ok: true, value: { page: 2, pageSize: 50, sort: "sla-soonest" } });
  });

  it.each([
    [{ status: "closed" }],
    [{ priority: "urgent" }],
    [{ category: "sales" }],
    [{ sort: "random" }],
    [{ search: "x".repeat(121) }],
    [{ assignedTo: "invalid agent" }],
  ])("rejects malformed ticket filters", (query) => {
    expect(parseAdminTicketListQuery(query).ok).toBe(false);
  });

  it.each([
    [{ page: "1.5" }],
    [{ action: "bad action" }],
    [{ resourceType: "x".repeat(65) }],
    [{ actorId: "a".repeat(129) }],
  ])("rejects malformed audit log filters", (query) => {
    expect(parseAuditLogQuery(query).ok).toBe(false);
  });

  it("parses bounded user-directory pagination and search", () => {
    expect(parseAdminUserListQuery({ page: "3", pageSize: "20", search: "customer" }))
      .toMatchObject({ ok: true, value: { page: 3, pageSize: 20, search: "customer" } });
    expect(parseAdminUserListQuery({ search: "x".repeat(121) }).ok).toBe(false);
    expect(parseAdminUserListQuery({ pageSize: "101" }).ok).toBe(false);
  });
});