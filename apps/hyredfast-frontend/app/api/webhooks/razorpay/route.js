import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/razorpay";
import {
  fulfilPayment,
  markPaymentFailed,
  refundPayment,
} from "@/lib/payments/fulfil";

// node crypto + pg — never the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Razorpay webhook — the authoritative fulfilment path.
 *
 * Register at $APP_URL/api/webhooks/razorpay with events payment.captured,
 * payment.failed and refund.processed. See docs/payments-razorpay.md.
 *
 * Two properties this endpoint must hold — the handler it replaced had neither:
 *   1. Signature verification over the RAW body. Anything else means anyone who
 *      knows the URL can mint companies with a curl.
 *   2. Idempotency. Razorpay retries on any non-2xx, so a handler that grants
 *      on every delivery grants forever.
 */
export async function POST(request) {
  // Raw text, not .json() — re-serialising a parsed object changes key order
  // and whitespace, and the HMAC will never match.
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const eventId = request.headers.get("x-razorpay-event-id");

  try {
    if (!verifyWebhookSignature({ rawBody, signature })) {
      console.warn("[razorpay-webhook] signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } catch (error) {
    // Missing RAZORPAY_WEBHOOK_SECRET — misconfiguration, not a bad request.
    console.error("[razorpay-webhook]", error.message);
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const event = JSON.parse(rawBody);
  const eventType = event.event;

  // Dedupe before doing any work. The unique index on event_id turns a
  // redelivery into a 200 no-op.
  let eventRow;
  try {
    eventRow = await prisma.paymentEvent.create({
      data: {
        eventId: eventId || `${eventType}:${event.created_at}`,
        eventType,
        payload: event,
      },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw error;
  }

  try {
    const result = await handleEvent(eventType, event);

    // Backfill the FK now that we know which payment this belonged to.
    if (result?.paymentRowId) {
      await prisma.paymentEvent.update({
        where: { id: eventRow.id },
        data: { paymentId: result.paymentRowId },
      });
    }

    return NextResponse.json({ received: true, handled: result?.handled ?? false });
  } catch (error) {
    // Drop the dedupe row so Razorpay's retry is actually processed rather than
    // being swallowed as a duplicate.
    await prisma.paymentEvent
      .delete({ where: { id: eventRow.id } })
      .catch(() => {});
    console.error(`[razorpay-webhook] ${eventType} failed:`, error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}

async function handleEvent(eventType, event) {
  const payment = event.payload?.payment?.entity;
  const refund = event.payload?.refund?.entity;

  switch (eventType) {
    case "payment.captured": {
      const result = await fulfilPayment({
        orderId: payment.order_id,
        paymentId: payment.id,
        method: payment.method,
        source: "webhook",
      });
      if (!result.ok) {
        console.warn(
          `[razorpay-webhook] captured ${payment.id}: ${result.reason}`,
        );
      }
      return { handled: result.ok, paymentRowId: result.payment?.id };
    }

    case "payment.failed": {
      const result = await markPaymentFailed({
        orderId: payment.order_id,
        paymentId: payment.id,
        reason: payment.error_description || payment.error_reason || null,
      });
      return { handled: result.updated > 0 };
    }

    case "refund.processed":
    case "refund.created": {
      const result = await refundPayment({ paymentId: refund.payment_id });
      if (!result.ok) {
        console.warn(
          `[razorpay-webhook] refund for ${refund.payment_id}: ${result.reason}`,
        );
      }
      return { handled: result.ok, paymentRowId: result.payment?.id };
    }

    default:
      // Acknowledge everything else so Razorpay stops retrying it.
      console.log(`[razorpay-webhook] ignoring ${eventType}`);
      return { handled: false };
  }
}
