import { tryAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request) {
  try {
    const { auth: user, response: authResponse } = tryAuth(request);
    if (authResponse) return authResponse;
    const records = await prisma.leadList.findMany({
      where: { userId: user.userId },
      orderBy: { created: "desc" },
    });

    return NextResponse.json({ items: records });
  } catch (error) {
    console.error("[API] Error fetching lead lists:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const { name, description } = await request.json();
  const { auth: user, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  try {
    const record = await prisma.leadList.create({
      data: {
        name,
        description: description || "",
        userId: user.userId,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error("[API] Error creating lead list:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
