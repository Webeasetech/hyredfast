import { NextResponse } from "next/server";
import { tryAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request) {
  try {
    const { auth: decoded, response: authResponse } = tryAuth(request);
    if (authResponse) return authResponse;
    await prisma.user.update({
      where: { id: decoded.userId },
      data: { isSetup: true },
    });

    return NextResponse.json({ message: "Setup complete" });
  } catch (error) {
    console.error("Error completing setup:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
