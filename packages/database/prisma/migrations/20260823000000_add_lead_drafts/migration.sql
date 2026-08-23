-- Lead drafts: the composer's staging area.
--
-- Purely additive. Nothing in campaigns, campaigns_email or lead_lists is
-- altered — draft rows get their own tables precisely so campaigns_email keeps
-- its invariant that every row is a real contact meant to be mailed.

-- CreateTable: one draft per campaign. The grid's columns are not stored — they
-- are the variables the campaign's pitches reference, derived on every read.
CREATE TABLE "lead_drafts" (
    "id" TEXT NOT NULL,
    "campaign" TEXT NOT NULL,
    "user" TEXT,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: every column past the primary key is nullable on purpose. A
-- draft row is allowed to be incomplete; validation happens at commit, not on
-- save, so that closing the tab never costs the user what they typed.
--
-- Company and role are not columns here. They are the same for every lead in a
-- group, so the UI states them once and writes them into each row's
-- personalization — which keeps the stored shape of a row, and every endpoint
-- that touches one, unchanged.
CREATE TABLE "lead_draft_rows" (
    "id" TEXT NOT NULL,
    "draft" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "email" TEXT,
    "personalization" JSONB,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_draft_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: one draft per campaign, enforced in the database rather than
-- only in the get-or-create route.
CREATE UNIQUE INDEX "lead_drafts_campaign_key" ON "lead_drafts"("campaign");

-- CreateIndex: the grid always reads a whole draft in display order.
CREATE INDEX "lead_draft_rows_draft_position_idx" ON "lead_draft_rows"("draft", "position");

-- AddForeignKey: deleting a campaign takes its draft, and the draft takes its
-- rows — a draft has no meaning without the campaign it stages leads for.
ALTER TABLE "lead_drafts" ADD CONSTRAINT "lead_drafts_campaign_fkey" FOREIGN KEY ("campaign") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_drafts" ADD CONSTRAINT "lead_drafts_user_fkey" FOREIGN KEY ("user") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lead_draft_rows" ADD CONSTRAINT "lead_draft_rows_draft_fkey" FOREIGN KEY ("draft") REFERENCES "lead_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
