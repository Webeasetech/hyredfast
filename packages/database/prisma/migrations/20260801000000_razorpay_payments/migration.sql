-- Razorpay payments. Additive only: no existing column is altered or dropped.
--
-- Billing unit is the COMPANY. `companies_total` is granted on a captured
-- payment, `companies_used` is consumed when a company is added. The existing
-- credits / ai_credits columns stay as internal metering for the send pipeline.
ALTER TABLE "users" ADD COLUMN "companies_total" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "companies_used" INTEGER NOT NULL DEFAULT 0;

-- One row per checkout attempt, written before the Razorpay modal opens.
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "razorpay_order_id" TEXT NOT NULL,
    "razorpay_payment_id" TEXT,
    "plan_id" TEXT NOT NULL,
    "companies_granted" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "method" TEXT,
    "failure_reason" TEXT,
    "notes" JSONB,
    "fulfilled_at" TIMESTAMP(3),
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- Raw webhook log, deduped on Razorpay's x-razorpay-event-id header.
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "payment" TEXT,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- This unique index is the idempotency guarantee: the client verify callback
-- and the webhook both race to claim a payment_id, and exactly one wins.
CREATE UNIQUE INDEX "payments_razorpay_order_id_key" ON "payments"("razorpay_order_id");
CREATE UNIQUE INDEX "payments_razorpay_payment_id_key" ON "payments"("razorpay_payment_id");
CREATE INDEX "payments_user_idx" ON "payments"("user");
CREATE UNIQUE INDEX "payment_events_event_id_key" ON "payment_events"("event_id");

ALTER TABLE "payments" ADD CONSTRAINT "payments_user_fkey"
    FOREIGN KEY ("user") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_fkey"
    FOREIGN KEY ("payment") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
