-- Back to credit billing. One credit is one email sent.
--
-- The company allowance is gone. Metering a company was never a clean question
-- — a company is consumed the moment its name is typed, which meant typing
-- "Bayer" and deleting it cost a slot with nothing to show for it, and no
-- honest way to refund. An email send is discrete, observable and already
-- debited atomically alongside the lead's stage advance, so it is the meter.
--
-- The Company / JobApplication hierarchy STAYS. It earns its place on grouping,
-- query shape and UI navigation independently of billing.

-- Credits become a whole number and the single limit on sending. Float was
-- always wrong for a counter that only ever moves by one.
UPDATE "users" SET "credits" = 0 WHERE "credits" IS NULL;
ALTER TABLE "users" ALTER COLUMN "credits" TYPE INTEGER USING ROUND(COALESCE("credits", 0))::INTEGER;
ALTER TABLE "users" ALTER COLUMN "credits" SET DEFAULT 0;
ALTER TABLE "users" ALTER COLUMN "credits" SET NOT NULL;

-- A payment now grants credits, not companies.
ALTER TABLE "payments" RENAME COLUMN "companies_granted" TO "credits_granted";

-- Nothing reads the monthly company allowance any more. Dropped rather than
-- left behind, so there is no second meter for a later reader to trust.
DROP TABLE IF EXISTS "company_quotas";
