-- A real default for daily_limit, and the last camelCase columns.
--
-- daily_limit was nullable with no default, so "how many may this mailbox send
-- today" was answered by whichever fallback the reading code happened to use:
--   email-service.ts  || 20   when picking a sender for a first touch
--   email-service.ts  || 30   when reusing the sticky sender for a follow-up
--   send-capacity.ts  ?? 20   when the scheduler sized the queue
-- A mailbox with no explicit limit was therefore capped at 20, 30, or 20
-- depending on the path, and the scheduler's plan disagreed with the sender's.
-- One default in the database removes the question.

-- 20 matches what the scheduler already assumed, so no existing campaign's
-- pacing changes. Users raise it per mailbox in Settings.
UPDATE "email_credentials" SET "dailyLimit" = 20 WHERE "dailyLimit" IS NULL;

-- The last six camelCase columns in the schema, missed by the 2026-08-30
-- rename because they had no @map to rewrite.
ALTER TABLE "email_credentials" RENAME COLUMN "dailyLimit" TO "daily_limit";
ALTER TABLE "email_credentials" RENAME COLUMN "imapEmail" TO "imap_email";
ALTER TABLE "email_credentials" RENAME COLUMN "imapHost" TO "imap_host";
ALTER TABLE "email_credentials" RENAME COLUMN "imapPassword" TO "imap_password";
ALTER TABLE "email_credentials" RENAME COLUMN "lastCheckedTime" TO "last_checked_time";
ALTER TABLE "campaigns" RENAME COLUMN "isTrackingEnabled" TO "is_tracking_enabled";

ALTER TABLE "email_credentials" ALTER COLUMN "daily_limit" SET DEFAULT 20;
ALTER TABLE "email_credentials" ALTER COLUMN "daily_limit" SET NOT NULL;
