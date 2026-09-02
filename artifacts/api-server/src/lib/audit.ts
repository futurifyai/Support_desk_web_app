import { db, auditLogsTable } from "@workspace/db";
import { logger } from "./logger";

export interface AuditEvent {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  meta?: Record<string, unknown> | null;
}

/**
 * Write an audit log event. Failures are logged but do not bubble up
 * so they never break the primary request path.
 */
export async function writeAudit(event: AuditEvent): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      actorId: event.actorId ?? null,
      actorEmail: event.actorEmail ?? null,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId ?? null,
      meta: event.meta ?? null,
    });
  } catch (err) {
    logger.error({ err, event }, "writeAudit failed");
  }
}
