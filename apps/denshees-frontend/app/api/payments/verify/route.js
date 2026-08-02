import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthError, unauthorized, verifyAuth } from "@/lib/auth";
import { verifyCheckoutSignature } from "@/lib/razorpay";
import { fulfilPayment } from "@/lib/payments/fulfil";

/**
 * Client-side confirmation, called from the Checkout `handler` callback.
 *
 * This is the fast path so the balance updates while the user is still looking
 * at the page. It is NOT the authoritative one — the webhook is, because it
 * fires even if the user closes the tab mid-payment. Both call the same
 * idempotent fulfilPayment(), so whichever lands first grants and the other
 * no-ops.
 */
export async function POST(request) {
  let auth;
  try {
    auth = verifyAuth(request);
  } catch (error) {
    if (error instanceof AuthError) return unauthorized(error);
    throw error;
  }

  try {
    const body = await request.json();
    const orderId = body.razorpay_order_id;
    const paymentId = body.razorpay_payment_id;
    const signature = body.razorpay_signature;

    if (!verifyCheckoutSignature({ orderId, paymentId, signature })) {
      console.warn(`[payments/verify] bad signature for order ${orderId}`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // The signature proves Razorpay issued this, but not that it belongs to the
    // caller — check ownership before granting anything.
    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId: orderId },
      select: { userId: true },
    });

    if (!payment) {
      return NextResponse.json({ error: "Unknown order" }, { status: 404 });
    }
    if (payment.userId !== auth.userId) {
      console.warn(
        `[payments/verify] user ${auth.userId} tried to claim order ${orderId} owned by ${payment.userId}`,
      );
      return NextResponse.json({ error: "Unknown order" }, { status: 404 });
    }

    const result = await fulfilPayment({
      orderId,
      paymentId,
      source: "verify",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      alreadyFulfilled: result.alreadyFulfilled,
      companiesTotal: result.user?.companiesTotal,
    });
  } catch (error) {
    console.error("[payments/verify] failed:", error);
    return NextResponse.json(
      { error: "Could not confirm payment" },
      { status: 500 },
    );
  }
}
