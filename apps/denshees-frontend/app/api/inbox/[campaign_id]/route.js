import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const PAGE_SIZE = 20;

export async function GET(request, props) {
  const params = await props.params;
  const campaign = params.campaign_id;
  const cursor = request.nextUrl.searchParams.get("cursor");

  try {
    const records = await prisma.campaignMessage.findMany({
      where: {
        sent: false,
        campaignEmail: { campaignId: campaign },
      },
      orderBy: { created: "desc" },
      include: { campaignEmail: true },
      take: PAGE_SIZE + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = records.length > PAGE_SIZE;
    const page = hasMore ? records.slice(0, PAGE_SIZE) : records;

    // Reshape to match old expand format
    const shaped = page.map(({ campaignEmail, ...rest }) => ({
      ...rest,
      expand: { campaign_email: campaignEmail },
    }));

    return NextResponse.json({
      items: shaped,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (error) {
    console.error(`[API] Error getting inbox for campaign ${campaign}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
