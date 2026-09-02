ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "rating" integer;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "feedback_text" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "sla_due_at" timestamp;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "sla_escalated" boolean NOT NULL DEFAULT false;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp;

CREATE INDEX IF NOT EXISTS "tickets_status_priority_idx"
  ON "tickets" ("status", "priority");
CREATE INDEX IF NOT EXISTS "tickets_sla_due_at_idx"
  ON "tickets" ("sla_due_at");