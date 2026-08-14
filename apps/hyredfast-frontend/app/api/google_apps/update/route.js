import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsCredential, notFound } from "@/lib/authz";

export async function PATCH(request) {
  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;

  try {
    const data = await request.json();

    if (!(await ownsCredential(auth.userId, data.id)))
      return notFound("Credential");

    await prisma.emailCredential.update({
      where: { id: data.id },
      data: { dailyLimit: data.dailyLimit },
    });

    return NextResponse.json({ message: "Data received", receivedData: data });
  } catch (error) {
    console.error("[API] Error updating Google app settings:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
