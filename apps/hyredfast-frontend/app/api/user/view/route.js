import { tryAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getBalance } from "@/lib/quota";

export async function GET(request) {
  try {
    const { auth: auth, response: authResponse } = tryAuth(request);
    if (authResponse) return authResponse;
    const record = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        avatar: true,
        credits: true,
        planId: true,
        planStartedAt: true,
        planExpiresAt: true,
        isSetup: true,
        created: true,
        updated: true,
      },
    });

    // The header chip and the billing page both want "how many emails are
    // left", which needs the term's expiry alongside the raw credit count.
    const balance = await getBalance(auth.userId);

    return NextResponse.json({ ...record, balance });
  } catch (error) {
    console.error("[API] Error getting current user:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
