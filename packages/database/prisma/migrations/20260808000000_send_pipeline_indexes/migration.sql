-- The daily allowance check counts sent messages per credential over a rolling
-- day. It runs once per send and once per credential per scheduler tick, and
-- both sides of that join were unindexed, so it degraded as the message log grew.

-- CreateIndex
CREATE INDEX "campaign_messages_campaign_email_sent_created_idx" ON "campaign_messages"("campaign_email", "sent", "created");

-- CreateIndex
CREATE INDEX "campaign_messages_message_id_idx" ON "campaign_messages"("message_id");

-- CreateIndex
CREATE INDEX "campaigns_email_cred_idx" ON "campaigns_email"("cred");
