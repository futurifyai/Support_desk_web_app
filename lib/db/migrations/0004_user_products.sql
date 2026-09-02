-- Admin-controlled product access grants for customer ticket creation.
CREATE TABLE IF NOT EXISTS "user_products" (
  "id"           text PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"      text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "product_name" text NOT NULL,
  "start_date"   timestamp,
  "end_date"     timestamp,
  "status"       text NOT NULL DEFAULT 'pending',
  "approved_by"  text REFERENCES "users"("id") ON DELETE SET NULL,
  "approved_at"  timestamp,
  "created_at"   timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_products_user_id_idx"
  ON "user_products" ("user_id");
CREATE INDEX IF NOT EXISTS "user_products_approved_lookup_idx"
  ON "user_products" ("user_id", "product_name", "status", "end_date");