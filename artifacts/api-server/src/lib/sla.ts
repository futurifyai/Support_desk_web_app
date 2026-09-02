export const SLA_HOURS = {
  critical: 4,
  high: 24,
  medium: 72,
  low: 168,
} as const;

export type TicketPriority = keyof typeof SLA_HOURS;

export function getSlaDueAt(priority: TicketPriority, from = new Date()): Date {
  return new Date(from.getTime() + SLA_HOURS[priority] * 60 * 60 * 1000);
}