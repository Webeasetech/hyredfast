import { tryAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(request) {
  const { name, username } = await request.json();

  try {
    const { auth: auth, response: authResponse } = tryAuth(request);
    if (authResponse) return authResponse;
    await prisma.user.update({
      where: { id: auth.userId },
      data: { name, username },
    });

    return NextResponse.json({ message: "Account updated" });
  } catch (error) {
    console.error("[API] Error updating account:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 400 },
    );
  }
}
