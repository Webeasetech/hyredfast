import { tryAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
        aiCredits: true,
        companiesTotal: true,
        companiesUsed: true,
        isSetup: true,
        created: true,
        updated: true,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error("[API] Error getting current user:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
