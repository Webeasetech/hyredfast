-- email_opens now cascades from its lead, the way campaign_messages already did.
--
-- The foreign key had no ON DELETE action, and the column is nullable, so
-- deleting a lead set campaign_lead_id to NULL and left the open event behind
-- pointing at nothing. Those rows are invisible to every per-campaign query
-- (they all join through the lead) but still counted in any bare
-- `SELECT count(*) FROM email_opens`, so open-rate maths drifts as leads are
-- removed. 490 such rows existed when this was found.

-- Clear what the missing cascade already stranded.
DELETE FROM "email_opens" WHERE "campaign_lead_id" IS NULL;

ALTER TABLE "email_opens" DROP CONSTRAINT IF EXISTS "email_opens_campaign_email_fkey";
ALTER TABLE "email_opens" DROP CONSTRAINT IF EXISTS "campaign_opens_campaign_email_fkey";
ALTER TABLE "email_opens" DROP CONSTRAINT IF EXISTS "email_opens_campaign_lead_id_fkey";

ALTER TABLE "email_opens"
  ADD CONSTRAINT "email_opens_campaign_lead_id_fkey"
  FOREIGN KEY ("campaign_lead_id") REFERENCES "campaign_leads"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
