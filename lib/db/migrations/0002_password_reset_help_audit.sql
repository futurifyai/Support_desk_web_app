-- Password reset tokens (hashed, time-limited)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_version" integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "password_resets" (
  "id"          text PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash"  text NOT NULL UNIQUE,
  "expires_at"  timestamp NOT NULL,
  "used"        boolean NOT NULL DEFAULT false,
  "created_at"  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "password_resets_user_id_idx"
  ON "password_resets" ("user_id");

-- Help / FAQ articles (static-seeded, searchable)
CREATE TABLE IF NOT EXISTS "help_articles" (
  "id"          text PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug"        text NOT NULL UNIQUE,
  "title"       text NOT NULL,
  "body"        text NOT NULL,
  "category"    text NOT NULL DEFAULT 'general',
  "tags"        text NOT NULL DEFAULT '',
  "created_at"  timestamp NOT NULL DEFAULT now(),
  "updated_at"  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "help_articles_category_idx"
  ON "help_articles" ("category");

-- Audit log
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"            text PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id"      text,
  "actor_email"   text,
  "action"        text NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id"   text,
  "meta"          jsonb,
  "created_at"    timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_logs_action_idx"
  ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "audit_logs_resource_idx"
  ON "audit_logs" ("resource_type", "resource_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx"
  ON "audit_logs" ("created_at" DESC);

-- Seed help articles (idempotent via ON CONFLICT DO NOTHING)
INSERT INTO "help_articles" ("slug", "title", "body", "category", "tags") VALUES
(
  'how-to-submit-a-ticket',
  'How to submit a support ticket',
  'To submit a support ticket, log in to your account and tap "New Ticket" on the home screen. Fill in the product name, describe your issue in detail, select a category (Bug, Feature Request, Billing, Account, or Other), and set a priority. Tap Submit and you will receive a confirmation. Our team will respond within the SLA window for your priority level.',
  'general',
  'ticket,submit,new,create'
),
(
  'check-ticket-status',
  'Checking the status of your ticket',
  'Open the SupportDesk app and go to "My Tickets". Each ticket displays a status badge: Open (awaiting triage), In Progress (being worked on), or Resolved (completed). Tap any ticket to read the full thread and any admin replies.',
  'general',
  'status,open,in-progress,resolved,track'
),
(
  'billing-payment-failed',
  'What to do when a payment fails',
  'If your payment fails, check that your card details are up to date in your account settings. Ensure you have sufficient funds and that your bank has not flagged the transaction. If the problem persists, submit a Billing ticket and our team will investigate within 4 hours.',
  'billing',
  'payment,billing,failed,card,charge'
),
(
  'reset-password',
  'How to reset your password',
  'On the login screen tap "Forgot password?" and enter your registered email address. You will receive a password reset link valid for one hour. Open the link, enter and confirm your new password (minimum 8 characters), and tap Reset Password. You can then log in with your new credentials.',
  'account',
  'password,reset,forgot,login'
),
(
  'account-locked',
  'My account appears to be locked',
  'Accounts are not locked automatically, but if you cannot log in, first try resetting your password. If you still cannot access your account, submit an Account ticket with your registered email address and our team will verify your identity and restore access.',
  'account',
  'locked,access,login,account'
),
(
  'report-a-bug',
  'How to report a bug effectively',
  'When submitting a Bug ticket, include: (1) the exact steps to reproduce the issue, (2) what you expected to happen, (3) what actually happened, (4) your device model and OS version, and (5) a screenshot if possible. Detailed reports help us resolve bugs faster.',
  'bug',
  'bug,report,reproduce,steps'
),
(
  'feature-request-guidelines',
  'Submitting a feature request',
  'We love hearing ideas from users! Submit a Feature Request ticket describing the feature you would like, the problem it solves, and how you would use it. Our product team reviews all requests and prioritised ones are added to the roadmap.',
  'feature',
  'feature,request,idea,roadmap'
),
(
  'sla-response-times',
  'Understanding SLA response times',
  'Our Service Level Agreement (SLA) defines how quickly we aim to respond based on ticket priority: Critical — 4 hours, High — 24 hours, Medium — 72 hours, Low — 168 hours. SLA clocks start when the ticket is submitted. You will be notified if your ticket approaches the SLA deadline.',
  'general',
  'sla,response,time,priority,deadline'
),
(
  'attach-screenshot',
  'How to attach a screenshot to a ticket',
  'While viewing a ticket, tap the attachment icon (paperclip) and choose an image from your device gallery. Images must be under 5 MB. Supported formats are JPEG, PNG, GIF, and WebP. Attachments help our team diagnose issues more quickly.',
  'general',
  'attachment,screenshot,image,upload'
),
(
  'rate-resolved-ticket',
  'Rating a resolved ticket',
  'Once a ticket is marked Resolved you will see a star-rating prompt. You can rate your experience from 1 to 5 stars and optionally leave written feedback. Ratings help us improve our support quality and are reviewed by our team regularly.',
  'general',
  'rating,feedback,stars,resolved,review'
)
ON CONFLICT ("slug") DO NOTHING;
