-- Shared API rate-limit counters. The primary key is an opaque SHA-256-derived
-- key, allowing atomic cross-instance increments without storing client IPs.
CREATE TABLE IF NOT EXISTS "api_rate_limits" (
  "key"               text PRIMARY KEY,
  "window_started_at" timestamp NOT NULL,
  "request_count"     integer NOT NULL,
  "updated_at"        timestamp NOT NULL DEFAULT now()
);