-- A lead is a person to write to, so it cannot exist without a name and an
-- address. Both write paths (the composer's commit and the add-lead dialog)
-- reject a contact missing either; this is the backstop for a path that forgets.
--
-- A missing name can be recovered from the address, so it is backfilled. A
-- missing address cannot be recovered from anything, so the ALTER below is
-- left to fail on it rather than deleting the row: an unsendable lead is still
-- the user's record of someone, and a migration is no place to decide it is
-- worthless. Verified against current data first, where this is a no-op —
-- 0 of 72 rows are blank in either column.
UPDATE "campaign_leads"
SET "name" = split_part("email", '@', 1)
WHERE ("name" IS NULL OR btrim("name") = '')
  AND "email" IS NOT NULL
  AND btrim("email") <> '';

ALTER TABLE "campaign_leads" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "campaign_leads" ALTER COLUMN "email" SET NOT NULL;
