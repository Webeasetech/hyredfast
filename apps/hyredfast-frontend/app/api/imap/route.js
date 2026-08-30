import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsPitch, notFound } from "@/lib/authz";

export async function PATCH(request) {
  const searchParams = new URL(request.url).searchParams;
  const pitch = searchParams.get("pitch");

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsPitch(auth.userId, pitch))) return notFound("Pitch");

  const { message, subject } = await request.json();

  try {
    const record = await prisma.pitchTemplate.update({
      where: { id: pitch },
      data: { message, subject },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error(`[API] Error updating pitch ${pitch}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
