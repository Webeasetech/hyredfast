import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthError, unauthorized, verifyAuth } from "@/lib/auth";
import { PLANS } from "@/lib/constants/plans";
import {
  getKeyId,
  getMode,
  getRazorpay,
  warnOnModeMismatch,
} from "@/lib/razorpay";

/**
 * Creates a Razorpay order and the local Payment row that tracks it.
 *
 * The client sends only a planId. The amount comes from the PLANS constant on
 * the server — never from the request body — so a tampered request cannot buy
 * a term for ₹1.
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
    const { planId } = await request.json();
    const plan = PLANS[planId];

    if (!plan) {
      return NextResponse.json(
        {
          error: `Unknown plan. Expected one of: ${Object.keys(PLANS).join(", ")}`,
        },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    warnOnModeMismatch();

    const order = await getRazorpay().orders.create({
      amount: plan.amount,
      currency: "INR",
      // Razorpay caps receipt at 40 characters.
      receipt: `${plan.id}_${Date.now()}`.slice(0, 40),
      notes: {
        userId: user.id,
        planId: plan.id,
        credits: String(plan.credits),
      },
    });

    await prisma.payment.create({
      data: {
        userId: user.id,
        razorpayOrderId: order.id,
        planId: plan.id,
        creditsGranted: plan.credits,
        amount: plan.amount,
        currency: "INR",
        status: "CREATED",
        notes: { receipt: order.receipt },
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: plan.amount,
      currency: "INR",
      credits: plan.credits,
      termMonths: plan.termMonths ?? null,
      planLabel: plan.label,
      keyId: getKeyId(),
      mode: getMode(),
      prefill: { name: user.name || "", email: user.email },
    });
  } catch (error) {
    console.error("[payments/create] failed:", error);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 },
    );
  }
}
