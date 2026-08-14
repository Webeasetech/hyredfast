import { NextResponse } from "next/server";
import { tryAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Marks the product walkthrough (react-joyride tour) as done for the user so it
// never shows again — called when the tour is completed, skipped, or closed.
export async function POST(request) {
  try {
    const { auth: decoded, response: authResponse } = tryAuth(request);
    if (authResponse) return authResponse;
    await prisma.user.update({
      where: { id: decoded.userId },
      data: { tourCompleted: true },
    });

    return NextResponse.json({ message: "Tour completed" });
  } catch (error) {
    console.error("Error completing tour:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
