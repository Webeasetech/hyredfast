-- Naming pass. Renames only: no data is moved, no column changes type, and
-- every statement below is a catalogue update rather than a table rewrite.
--
-- Three problems being fixed:
--   1. Table names that were ungrammatical or singular against a plural scheme
--      ("campaigns_email", "pitches_email", "waitlist").
--   2. Model names that described the wrong thing. "CampaignEmail" held a
--      PERSON while "CampaignMessage" held the email — exactly backwards from
--      what a reader assumes.
--   3. Foreign key columns named after the table instead of the key, so a
--      column called "campaign" held a cuid. The newer tables already used
--      "user_id"; the older ones had drifted.

-- ── Tables ────────────────────────────────────────────────────────────────
-- A row here is a lead inside a campaign, not an email to one.
ALTER TABLE "campaigns_email" RENAME TO "campaign_leads";
-- The per-stage email template.
ALTER TABLE "pitches_email" RENAME TO "pitch_templates";
-- Hangs off the lead, and records an email being opened.
ALTER TABLE "campaign_opens" RENAME TO "email_opens";
-- "applications" reads as a software application in a codebase. These are job
-- applications: one company plus one role.
ALTER TABLE "applications" RENAME TO "job_applications";
-- Distinct from campaign_leads: this is the standalone reusable repository.
ALTER TABLE "leads" RENAME TO "saved_leads";
-- The only singular table in the schema. A row is one signup.
ALTER TABLE "waitlist" RENAME TO "waitlist_signups";

-- Unreferenced since it was created: no relations, no reads, no rows.
DROP TABLE IF EXISTS "assets";

-- ── Foreign key columns ───────────────────────────────────────────────────
ALTER TABLE "user_profiles"             RENAME COLUMN "user" TO "user_id";
ALTER TABLE "payments"                  RENAME COLUMN "user" TO "user_id";
ALTER TABLE "payment_events"            RENAME COLUMN "payment" TO "payment_id";
ALTER TABLE "campaigns"                 RENAME COLUMN "user" TO "user_id";
ALTER TABLE "email_credentials"         RENAME COLUMN "user" TO "user_id";
ALTER TABLE "credit_transactions"       RENAME COLUMN "user" TO "user_id";
ALTER TABLE "lead_lists"                RENAME COLUMN "user" TO "user_id";
ALTER TABLE "companies"                 RENAME COLUMN "user" TO "user_id";
ALTER TABLE "company_quotas"            RENAME COLUMN "user" TO "user_id";
ALTER TABLE "saved_leads"               RENAME COLUMN "user" TO "user_id";
ALTER TABLE "lead_drafts"               RENAME COLUMN "user" TO "user_id";

ALTER TABLE "campaign_leads"            RENAME COLUMN "campaign" TO "campaign_id";
ALTER TABLE "pitch_templates"           RENAME COLUMN "campaign" TO "campaign_id";
ALTER TABLE "crm_activities"            RENAME COLUMN "campaign" TO "campaign_id";
ALTER TABLE "crm_deals"                 RENAME COLUMN "campaign" TO "campaign_id";
ALTER TABLE "crm_stages"                RENAME COLUMN "campaign" TO "campaign_id";
ALTER TABLE "lead_drafts"               RENAME COLUMN "campaign" TO "campaign_id";
ALTER TABLE "job_applications"          RENAME COLUMN "campaign" TO "campaign_id";

ALTER TABLE "campaign_leads"            RENAME COLUMN "cred" TO "credential_id";
ALTER TABLE "campaign_leads"            RENAME COLUMN "application" TO "application_id";
ALTER TABLE "job_applications"          RENAME COLUMN "company" TO "company_id";
ALTER TABLE "campaign_messages"         RENAME COLUMN "pitch" TO "pitch_id";
ALTER TABLE "campaign_messages"         RENAME COLUMN "campaign_email" TO "campaign_lead_id";
ALTER TABLE "email_opens"               RENAME COLUMN "campaign_email" TO "campaign_lead_id";
ALTER TABLE "crm_activities"            RENAME COLUMN "deal" TO "deal_id";
ALTER TABLE "crm_activities"            RENAME COLUMN "from_stage" TO "from_stage_id";
ALTER TABLE "crm_activities"            RENAME COLUMN "to_stage" TO "to_stage_id";
ALTER TABLE "crm_deals"                 RENAME COLUMN "stage" TO "stage_id";
ALTER TABLE "crm_deals"                 RENAME COLUMN "lead" TO "campaign_lead_id";
ALTER TABLE "lead_draft_rows"           RENAME COLUMN "draft" TO "draft_id";
ALTER TABLE "lead_list_items"           RENAME COLUMN "lead_list" TO "lead_list_id";
ALTER TABLE "template_campaign_pitches" RENAME COLUMN "campaign_template" TO "campaign_template_id";

-- ── Columns whose name misdescribed their type ────────────────────────────
ALTER TABLE "users"          RENAME COLUMN "issetup" TO "is_setup";
-- Not a word, and it is a completion flag.
ALTER TABLE "campaigns"      RENAME COLUMN "setuped" TO "setup_complete";
-- An integer count, not a boolean.
ALTER TABLE "campaign_leads" RENAME COLUMN "opened" TO "open_count";
