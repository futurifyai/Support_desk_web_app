import { parsePositiveInteger, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, type TicketCategory, type TicketStatus } from "./ticketFilters";
import type { TicketPriority } from "./sla";

type QueryResult<T> = { ok: true; value: T } | { ok: false; message: string };

function boundedText(value: unknown, field: string, maximum: number, pattern = /^[A-Za-z0-9_:-]+$/): QueryResult<string> {
  if (value === undefined || value === "") return { ok: true, value: "" };
  if (typeof value !== "string" || value.length > maximum || !pattern.test(value)) {
    return { ok: false, message: `Invalid ${field} filter` };
  }
  return { ok: true, value };
}

export type AdminTicketListQuery = {
  page: number;
  pageSize: number;
  search: string;
  status: TicketStatus | "";
  priority: TicketPriority | "";
  category: TicketCategory | "";
  assignedTo: string;
  sort: "newest" | "oldest" | "sla-soonest";
};

export function parseAdminTicketListQuery(query: Record<string, unknown>): QueryResult<AdminTicketListQuery> {
  const page = parsePositiveInteger(query["page"], 1, 100_000);
  const pageSize = parsePositiveInteger(query["pageSize"], 30, 100);
  if (page === null || pageSize === null) return { ok: false, message: "Page and pageSize must be positive integers (pageSize up to 100)" };
  const search = typeof query["search"] === "string" ? query["search"].trim() : "";
  if (search.length > 120) return { ok: false, message: "Search must be 120 characters or fewer" };
  const status = typeof query["status"] === "string" ? query["status"] : "";
  const priority = typeof query["priority"] === "string" ? query["priority"] : "";
  const category = typeof query["category"] === "string" ? query["category"] : "";
  const sort = typeof query["sort"] === "string" && query["sort"] ? query["sort"] : "newest";
  if (status && !TICKET_STATUSES.includes(status as TicketStatus)) return { ok: false, message: "Invalid ticket status filter" };
  if (priority && !TICKET_PRIORITIES.includes(priority as TicketPriority)) return { ok: false, message: "Invalid ticket priority filter" };
  if (category && !TICKET_CATEGORIES.includes(category as TicketCategory)) return { ok: false, message: "Invalid ticket category filter" };
  if (!["newest", "oldest", "sla-soonest"].includes(sort)) return { ok: false, message: "Invalid ticket sort" };
  const assignedTo = boundedText(query["assignedTo"], "assigned agent", 128);
  if (!assignedTo.ok) return assignedTo;
  return {
    ok: true,
    value: {
      page,
      pageSize,
      search,
      status: status as TicketStatus | "",
      priority: priority as TicketPriority | "",
      category: category as TicketCategory | "",
      assignedTo: assignedTo.value,
      sort: sort as AdminTicketListQuery["sort"],
    },
  };
}

export type AuditLogQuery = {
  page: number;
  pageSize: number;
  action: string;
  resourceType: string;
  actorId: string;
};

export function parseAuditLogQuery(query: Record<string, unknown>): QueryResult<AuditLogQuery> {
  const page = parsePositiveInteger(query["page"], 1, 100_000);
  const pageSize = parsePositiveInteger(query["pageSize"], 50, 100);
  if (page === null || pageSize === null) return { ok: false, message: "Page and pageSize must be positive integers (pageSize up to 100)" };
  const action = boundedText(query["action"], "action", 100);
  const resourceType = boundedText(query["resourceType"], "resource type", 64);
  const actorId = boundedText(query["actorId"], "actor", 128);
  if (!action.ok) return action;
  if (!resourceType.ok) return resourceType;
  if (!actorId.ok) return actorId;
  return { ok: true, value: { page, pageSize, action: action.value, resourceType: resourceType.value, actorId: actorId.value } };
}

export type AdminUserListQuery = {
  page: number;
  pageSize: number;
  search: string;
};

export function parseAdminUserListQuery(query: Record<string, unknown>): QueryResult<AdminUserListQuery> {
  const page = parsePositiveInteger(query["page"], 1, 100_000);
  const pageSize = parsePositiveInteger(query["pageSize"], 30, 100);
  if (page === null || pageSize === null) {
    return { ok: false, message: "Page and pageSize must be positive integers (pageSize up to 100)" };
  }
  const search = typeof query["search"] === "string" ? query["search"].trim() : "";
  if (search.length > 120) return { ok: false, message: "Search must be 120 characters or fewer" };
  return { ok: true, value: { page, pageSize, search } };
}