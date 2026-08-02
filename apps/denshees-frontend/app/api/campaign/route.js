import { NextResponse } from "next/server";
import { tryAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request) {
  const { auth: user, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  try {
    const [campaigns, totalItems] = await Promise.all([
      prisma.campaign.findMany({
        where: { userId: user.userId, deleted: false },
        orderBy: { created: "desc" },
        take: 25,
      }),
      prisma.campaign.count({ where: { userId: user.userId, deleted: false } }),
    ]);

    return NextResponse.json({
      items: campaigns,
      totalItems,
      page: 1,
      perPage: 25,
    });
  } catch (error) {
    console.error("[API] Error getting campaigns:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
