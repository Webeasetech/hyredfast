-- Company / Application hierarchy, and the monthly company quota.
--
-- Before: Campaign -> CampaignEmail, with company and role buried in each
-- contact's `personalization` JSON. Nothing counted companies, so the billing
-- unit had no row to point at and `companies_used` was incremented by nothing.
--
-- After: User -> Company -> Application -> CampaignEmail. Company sits at user
-- level because that is the billable decision ("I am applying to Bayer"), and
-- charging it twice because it appears in two campaigns would be wrong.
--
-- `personalization` keeps its copy of company and role on purpose. It is the
-- render payload for {{company}} / {{role}} in the pitch templates; the foreign
-- key is the structural truth. They are two different jobs, not duplication.

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT,
    "role_slug" TEXT NOT NULL,
    "campaign" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- One row per user per month. A refill is the next month's row not existing
-- yet, so there is no reset job that can fail and hand someone a free month.
CREATE TABLE "company_quotas" (
    "id" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_quotas_pkey" PRIMARY KEY ("id")
);

-- The dedupe that makes the quota honest: "Bayer" and "bayer" are one slot.
CREATE UNIQUE INDEX "companies_user_slug_key" ON "companies"("user", "slug");
CREATE INDEX "companies_user_idx" ON "companies"("user");
CREATE UNIQUE INDEX "applications_company_role_slug_campaign_key" ON "applications"("company", "role_slug", "campaign");
CREATE INDEX "applications_campaign_idx" ON "applications"("campaign");
CREATE UNIQUE INDEX "company_quotas_user_period_start_key" ON "company_quotas"("user", "period_start");

ALTER TABLE "companies" ADD CONSTRAINT "companies_user_fkey" FOREIGN KEY ("user") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_company_fkey" FOREIGN KEY ("company") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_campaign_fkey" FOREIGN KEY ("campaign") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_quotas" ADD CONSTRAINT "company_quotas_user_fkey" FOREIGN KEY ("user") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The link from a contact to what it is an application to.
ALTER TABLE "campaigns_email" ADD COLUMN "application" TEXT;
CREATE INDEX "campaigns_email_application_idx" ON "campaigns_email"("application");

-- Plan is a fixed TERM, not a balance, so the two lifetime counters go.
ALTER TABLE "users" ADD COLUMN "plan_id" TEXT;
ALTER TABLE "users" ADD COLUMN "plan_started_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "plan_expires_at" TIMESTAMP(3);

-- ==========================================================================
-- Backfill
-- ==========================================================================
-- Folding rule, and it must match `companySlug()` in lib/company.js exactly:
-- lowercase, strip everything that is not a letter, digit or space, collapse
-- runs of whitespace, trim. Written inline because a migration cannot import.
--
-- Contacts with neither company nor role land under a per-user "(Unassigned)"
-- company, so the hierarchy has no special case and every contact has a parent.
-- That placeholder is skipped by the quota: it represents no decision to apply
-- anywhere, so it must not consume a slot.

-- Companies, one per (user, folded company name).
INSERT INTO "companies" ("id", "user", "name", "slug")
SELECT
    gen_random_uuid()::text,
    c."user",
    MIN(TRIM(ce."personalization"->>'company')),
    btrim(regexp_replace(regexp_replace(lower(ce."personalization"->>'company'), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'))
FROM "campaigns_email" ce
JOIN "campaigns" c ON c."id" = ce."campaign"
WHERE c."user" IS NOT NULL
  AND COALESCE(TRIM(ce."personalization"->>'company'), '') <> ''
GROUP BY c."user", btrim(regexp_replace(regexp_replace(lower(ce."personalization"->>'company'), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'));

-- The "(Unassigned)" bucket, for users who have contacts carrying no company.
-- The DISTINCT has to happen before the id is generated: gen_random_uuid() is
-- volatile, so selecting it alongside makes every row unique and dedupes nothing.
INSERT INTO "companies" ("id", "user", "name", "slug")
SELECT gen_random_uuid()::text, u."user", '(Unassigned)', '__unassigned__'
FROM (
    SELECT DISTINCT c."user"
    FROM "campaigns_email" ce
    JOIN "campaigns" c ON c."id" = ce."campaign"
    WHERE c."user" IS NOT NULL
      AND COALESCE(TRIM(ce."personalization"->>'company'), '') = ''
) u;

-- Applications, one per (company, folded role, campaign).
INSERT INTO "applications" ("id", "company", "role", "role_slug", "campaign", "updated")
SELECT
    gen_random_uuid()::text,
    co."id",
    MIN(NULLIF(TRIM(ce."personalization"->>'role'), '')),
    btrim(regexp_replace(regexp_replace(lower(COALESCE(ce."personalization"->>'role', '')), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g')),
    ce."campaign",
    CURRENT_TIMESTAMP
FROM "campaigns_email" ce
JOIN "campaigns" c ON c."id" = ce."campaign"
JOIN "companies" co
  ON co."user" = c."user"
 AND co."slug" = CASE
        WHEN COALESCE(TRIM(ce."personalization"->>'company'), '') = '' THEN '__unassigned__'
        ELSE btrim(regexp_replace(regexp_replace(lower(ce."personalization"->>'company'), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'))
     END
WHERE c."user" IS NOT NULL
GROUP BY co."id", ce."campaign",
         btrim(regexp_replace(regexp_replace(lower(COALESCE(ce."personalization"->>'role', '')), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'));

-- Point every contact at its application.
UPDATE "campaigns_email" ce
SET "application" = a."id"
FROM "campaigns" c
JOIN "companies" co ON co."user" = c."user"
JOIN "applications" a ON a."company" = co."id" AND a."campaign" = c."id"
WHERE c."id" = ce."campaign"
  AND co."slug" = CASE
        WHEN COALESCE(TRIM(ce."personalization"->>'company'), '') = '' THEN '__unassigned__'
        ELSE btrim(regexp_replace(regexp_replace(lower(ce."personalization"->>'company'), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'))
     END
  AND a."role_slug" = btrim(regexp_replace(regexp_replace(lower(COALESCE(ce."personalization"->>'role', '')), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'));

ALTER TABLE "campaigns_email" ADD CONSTRAINT "campaigns_email_application_fkey" FOREIGN KEY ("application") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed this month's quota from what the backfill created, so an existing user's
-- allowance reflects companies they already have. The placeholder never counts.
INSERT INTO "company_quotas" ("id", "user", "period_start", "used", "updated")
SELECT
    gen_random_uuid()::text,
    co."user",
    date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    COUNT(*),
    CURRENT_TIMESTAMP
FROM "companies" co
WHERE co."slug" <> '__unassigned__'
GROUP BY co."user";

-- Last, now that everything is derived from them.
ALTER TABLE "users" DROP COLUMN "companies_total";
ALTER TABLE "users" DROP COLUMN "companies_used";
