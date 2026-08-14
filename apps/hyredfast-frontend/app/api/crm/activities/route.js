import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsCampaign, ownsCrmDeal, notFound } from "@/lib/authz";

export async function GET(request) {
  const searchParams = new URL(request.url).searchParams;
  const deal = searchParams.get("deal");
  const campaign = searchParams.get("campaign");
  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsCampaign(auth.userId, campaign))) return notFound("Campaign");

  if (!deal && !campaign) {
    return NextResponse.json(
      { message: "deal or campaign is required" },
      { status: 400 },
    );
  }

  try {
    const where = deal ? { dealId: deal } : { campaignId: campaign };

    const records = await prisma.crmActivity.findMany({
      where,
      orderBy: { created: "desc" },
      include: { fromStage: true, toStage: true },
    });

    const shaped = records.map(({ fromStage, toStage, ...rest }) => ({
      ...rest,
      expand: { from_stage: fromStage, to_stage: toStage },
    }));

    return NextResponse.json(shaped);
  } catch (error) {
    console.error("[API] Error getting CRM activities:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;

  const body = await request.json();

  if (!(await ownsCampaign(auth.userId, body.campaign)))
    return notFound("Campaign");
  if (body.deal && !(await ownsCrmDeal(auth.userId, body.deal)))
    return notFound("Deal");

  try {
    const record = await prisma.crmActivity.create({
      data: {
        dealId: body.deal,
        campaignId: body.campaign,
        type: body.type,
        description: body.description,
        fromStageId: body.from_stage,
        toStageId: body.to_stage,
      },
      include: { fromStage: true, toStage: true },
    });

    const { fromStage, toStage, ...rest } = record;
    return NextResponse.json({
      ...rest,
      expand: { from_stage: fromStage, to_stage: toStage },
    });
  } catch (error) {
    console.error("[API] Error creating CRM activity:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
