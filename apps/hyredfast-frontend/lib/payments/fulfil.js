import prisma from "@/lib/prisma";
import { PLANS } from "@/lib/constants/plans";
import { grantCredits, termEnd } from "@/lib/quota";

/**
 * The single place companies are granted for a payment.
 *
 * Two callers race by design: the browser posts to /api/payments/verify the
 * instant Checkout closes (fast, good UX) and Razorpay delivers
 * `payment.captured` to the webhook (authoritative, arrives even if the user
 * shuts the tab). Both funnel through here, and exactly one grants.
 *
 * Idempotency is a conditional update, not a read-then-write: `updateMany`
 * with `status: "CREATED"` in the WHERE is an atomic compare-and-set at the row
 * level, so a `count` of 0 means another transaction already claimed it. A
 * read-then-write would let two concurrent callers both see CREATED and both
 * increment.
 */
export async function fulfilPayment({ orderId, paymentId, method, source }) {
  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: orderId },
  });

  if (!payment) return { ok: false, reason: "unknown_order" };
  if (payment.status === "PAID") {
    return { ok: true, alreadyFulfilled: true, payment };
  }
  if (payment.status === "REFUNDED") {
    return { ok: false, reason: "refunded", payment };
  }

  return prisma.$transaction(async (tx) => {
    // One timestamp for both the payment and the term it starts. Taking
    // `new Date()` twice put fulfilledAt a few milliseconds before
    // planStartedAt, and "payments fulfilled since the term began" then
    // excluded the very payment that began it.
    const fulfilledAt = new Date();

    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: ["CREATED", "FAILED"] } },
      data: {
        razorpayPaymentId: paymentId,
        status: "PAID",
        method: method ?? undefined,
        failureReason: null,
        fulfilledAt,
      },
    });

    // Lost the race — the other caller is granting (or already has).
    if (claimed.count === 0) {
      const current = await tx.payment.findUnique({
        where: { id: payment.id },
      });
      return { ok: true, alreadyFulfilled: true, payment: current };
    }

    const plan = PLANS[payment.planId];

    // Both a term and a top-up grant credits; only a term moves the expiry.
    await grantCredits(tx, payment.userId, payment.creditsGranted);

    if (plan?.termMonths) {
      // Buying while a term is still running extends it from where it ends
      // rather than from today, so nobody loses days they already paid for by
      // renewing early.
      const existing = await tx.user.findUnique({
        where: { id: payment.userId },
        select: { planExpiresAt: true },
      });
      const runningUntil =
        existing?.planExpiresAt && new Date(existing.planExpiresAt) > new Date()
          ? new Date(existing.planExpiresAt)
          : new Date();

      await tx.user.update({
        where: { id: payment.userId },
        data: {
          planId: plan.id,
          planStartedAt: fulfilledAt,
          planExpiresAt: termEnd(plan, runningUntil),
        },
      });
    }

    const user = await tx.user.findUnique({
      where: { id: payment.userId },
      select: { id: true, credits: true, planId: true, planExpiresAt: true },
    });

    console.log(
      `[payments] granted ${payment.creditsGranted} credits to ${user.id} for ${paymentId} (via ${source}), balance ${user.credits}`,
    );

    return { ok: true, alreadyFulfilled: false, payment, user };
  });
}

/** Marks a payment failed. Never touches the user's balance. */
export async function markPaymentFailed({ orderId, paymentId, reason }) {
  const updated = await prisma.payment.updateMany({
    // Guard on status so a late `payment.failed` cannot undo a captured
    // payment — Razorpay can deliver events out of order.
    where: { razorpayOrderId: orderId, status: "CREATED" },
    data: {
      razorpayPaymentId: paymentId ?? undefined,
      status: "FAILED",
      failureReason: reason ?? null,
    },
  });
  return { updated: updated.count };
}

/**
 * Reverses a fulfilled payment. Credits are clawed back and clamped at zero;
 * a refunded term also expires immediately.
 */
export async function refundPayment({ paymentId, orderId }) {
  const payment = await prisma.payment.findFirst({
    where: paymentId
      ? { razorpayPaymentId: paymentId }
      : { razorpayOrderId: orderId },
  });

  if (!payment) return { ok: false, reason: "unknown_payment" };
  if (payment.status !== "PAID") {
    return { ok: true, alreadyHandled: true, payment };
  }

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: "PAID" },
      data: { status: "REFUNDED" },
    });
    if (claimed.count === 0) {
      return { ok: true, alreadyHandled: true, payment };
    }

    const plan = PLANS[payment.planId];

    // Claw the credits back, clamped at zero: credits already spent cannot be
    // un-spent, and a negative balance would read as "owes us emails".
    const current = await tx.user.findUnique({
      where: { id: payment.userId },
      select: { credits: true },
    });
    await tx.user.update({
      where: { id: payment.userId },
      data: {
        credits: Math.max(0, (current?.credits ?? 0) - payment.creditsGranted),
        // A refunded term ends now. A top-up leaves the term alone.
        ...(plan?.termMonths ? { planExpiresAt: new Date() } : {}),
      },
    });

    console.log(
      `[payments] refunded ${payment.planId} for ${payment.userId} (${payment.razorpayPaymentId})`,
    );

    return { ok: true, alreadyHandled: false, payment };
  });
}
