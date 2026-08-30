import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsCampaign, notFound } from "@/lib/authz";

export async function GET(request) {
  const searchParams = new URL(request.url).searchParams;
  const campaign = searchParams.get("campaign");
  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsCampaign(auth.userId, campaign))) return notFound("Campaign");

  try {
    const [items, totalItems] = await Promise.all([
      prisma.pitchTemplate.findMany({
        where: { campaignId: campaign },
        orderBy: { stage: "asc" },
        take: 25,
      }),
      prisma.pitchTemplate.count({ where: { campaignId: campaign } }),
    ]);

    return NextResponse.json({ items, totalItems, page: 1, perPage: 25 });
  } catch (error) {
    console.error(
      `[API] Error getting pitches for campaign ${campaign}:`,
      error,
    );
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
