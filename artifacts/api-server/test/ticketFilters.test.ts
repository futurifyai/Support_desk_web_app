import { describe, expect, it } from "vitest";
import { parseTicketListQuery } from "../src/lib/ticketFilters";

describe("parseTicketListQuery", () => {
  it("applies safe defaults and keeps the date range inclusive", () => {
    const result = parseTicketListQuery({
      search: "  printer  ",
      status: "resolved",
      priority: "high",
      category: "bug",
      startDate: "2024-02-28",
      endDate: "2024-02-29",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        page: 1,
        pageSize: 30,
        search: "printer",
        status: "resolved",
        priority: "high",
        category: "bug",
      },
    });
    if (result.ok) {
      expect(result.value.start.toISOString()).toBe("2024-02-28T00:00:00.000Z");
      expect(result.value.end.toISOString()).toBe("2024-03-01T00:00:00.000Z");
    }
  });

  it.each([
    ["fractional page", { page: "1.5" }],
    ["zero page", { page: "0" }],
    ["non-numeric page", { page: "abc" }],
    ["oversized page size", { pageSize: "101" }],
    ["unsafe page", { page: "999999999999999999999" }],
  ])("rejects %s", (_label, query) => {
    const result = parseTicketListQuery(query);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ message: expect.stringContaining("Page") });
  });

  it.each([
    ["impossible leap day", "2023-02-29"],
    ["impossible month day", "2024-02-31"],
    ["invalid shape", "02-29-2024"],
  ])("rejects %s", (_label, date) => {
    const result = parseTicketListQuery({ startDate: date });
    expect(result).toEqual({ ok: false, message: "Dates must use the YYYY-MM-DD format" });
  });

  it("rejects a reversed date range", () => {
    const result = parseTicketListQuery({ startDate: "2024-04-10", endDate: "2024-04-09" });
    expect(result).toEqual({ ok: false, message: "End date must be on or after the start date" });
  });

  it.each([
    ["status", { status: "closed" }],
    ["priority", { priority: "urgent" }],
    ["category", { category: "sales" }],
  ])("rejects an invalid %s filter", (_label, query) => {
    expect(parseTicketListQuery(query).ok).toBe(false);
  });
});