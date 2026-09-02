-- Track product access that was blocked automatically after its end date.
ALTER TABLE "user_products"
  ADD COLUMN IF NOT EXISTS "expired_at" timestamp;