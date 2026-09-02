import type { TicketPriority } from "./sla";

export const TICKET_STATUSES = ["open", "in-progress", "resolved"] as const;
export const TICKET_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const TICKET_CATEGORIES = ["bug", "feature", "billing", "account", "other"] as const;

export type TicketStatus = typeof TICKET_STATUSES[number];
export type TicketCategory = typeof TICKET_CATEGORIES[number];

export type TicketListQuery = {
  page: number;
  pageSize: number;
  search: string;
  status: TicketStatus | "";
  priority: TicketPriority | "";
  category: TicketCategory | "";
  start: Date | null;
  end: Date | null;
};

export type TicketQueryResult =
  | { ok: true; value: TicketListQuery }
  | { ok: false; message: string };

export function parsePositiveInteger(value: unknown, fallback: number, maximum?: number): number | null {
  if (value === undefined || value === "") return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || (maximum !== undefined && parsed > maximum)) return null;
  return parsed;
}

function parseCalendarDate(value: unknown, endOfDay = false): Date | null {
  if (typeof value !== "string" || !value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null;
  if (endOfDay) parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed;
}

export function parseTicketListQuery(query: Record<string, unknown>): TicketQueryResult {
  const page = parsePositiveInteger(query["page"], 1, 100_000);
  const pageSize = parsePositiveInteger(query["pageSize"], 30, 100);
  if (page === null || pageSize === null) {
    return { ok: false, message: "Page and pageSize must be positive integers (pageSize up to 100)" };
  }

  const search = typeof query["search"] === "string" ? query["search"].trim().slice(0, 120) : "";
  const status = typeof query["status"] === "string" ? query["status"] : "";
  const priority = typeof query["priority"] === "string" ? query["priority"] : "";
  const category = typeof query["category"] === "string" ? query["category"] : "";
  const startDate = typeof query["startDate"] === "string" ? query["startDate"] : "";
  const endDate = typeof query["endDate"] === "string" ? query["endDate"] : "";

  if (status && !TICKET_STATUSES.includes(status as TicketStatus)) {
    return { ok: false, message: "Invalid ticket status filter" };
  }
  if (priority && !TICKET_PRIORITIES.includes(priority as TicketPriority)) {
    return { ok: false, message: "Invalid ticket priority filter" };
  }
  if (category && !TICKET_CATEGORIES.includes(category as TicketCategory)) {
    return { ok: false, message: "Invalid ticket category filter" };
  }

  const start = startDate ? parseCalendarDate(startDate) : null;
  const end = endDate ? parseCalendarDate(endDate, true) : null;
  if ((startDate && !start) || (endDate && !end)) {
    return { ok: false, message: "Dates must use the YYYY-MM-DD format" };
  }
  if (start && end && start >= end) {
    return { ok: false, message: "End date must be on or after the start date" };
  }

  return {
    ok: true,
    value: {
      page,
      pageSize,
      search,
      status: status as TicketStatus | "",
      priority: priority as TicketPriority | "",
      category: category as TicketCategory | "",
      start,
      end,
    },
  };
}