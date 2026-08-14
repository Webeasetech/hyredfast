import prisma from "@/lib/prisma";

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
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: ["CREATED", "FAILED"] } },
      data: {
        razorpayPaymentId: paymentId,
        status: "PAID",
        method: method ?? undefined,
        failureReason: null,
        fulfilledAt: new Date(),
      },
    });

    // Lost the race — the other caller is granting (or already has).
    if (claimed.count === 0) {
      const current = await tx.payment.findUnique({ where: { id: payment.id } });
      return { ok: true, alreadyFulfilled: true, payment: current };
    }

    const user = await tx.user.update({
      where: { id: payment.userId },
      data: { companiesTotal: { increment: payment.companiesGranted } },
      select: { id: true, companiesTotal: true, companiesUsed: true },
    });

    console.log(
      `[payments] granted ${payment.companiesGranted} companies to ${user.id} for ${paymentId} (via ${source})`,
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
 * Reverses a fulfilled payment. Clamps at zero rather than going negative:
 * companies already consumed cannot be un-consumed, and a negative balance
 * would break every `companiesTotal - companiesUsed` check downstream.
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

    const user = await tx.user.findUnique({
      where: { id: payment.userId },
      select: { companiesTotal: true },
    });
    const next = Math.max(0, (user?.companiesTotal ?? 0) - payment.companiesGranted);

    await tx.user.update({
      where: { id: payment.userId },
      data: { companiesTotal: next },
    });

    console.log(
      `[payments] refunded ${payment.companiesGranted} companies from ${payment.userId} (${payment.razorpayPaymentId})`,
    );

    return { ok: true, alreadyHandled: false, payment };
  });
}
