import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsCampaign, ownsContact, ownsCrmStage, notFound } from "@/lib/authz";

export async function GET(request) {
  const searchParams = new URL(request.url).searchParams;
  const campaign = searchParams.get("campaign");
  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsCampaign(auth.userId, campaign))) return notFound("Campaign");
  const stage = searchParams.get("stage");

  if (!campaign) {
    return NextResponse.json(
      { message: "campaign is required" },
      { status: 400 },
    );
  }

  try {
    const where = { campaignId: campaign };
    if (stage) where.stageId = stage;

    const records = await prisma.crmDeal.findMany({
      where,
      orderBy: { created: "desc" },
      include: { lead: true, stage: true },
    });

    // Reshape to match old expand format
    const shaped = records.map(({ lead, stage, ...rest }) => ({
      ...rest,
      stage: rest.stageId,
      expand: { lead, stage },
    }));

    return NextResponse.json(shaped);
  } catch (error) {
    console.error("[API] Error getting CRM deals:", error);
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
  // The lead and stage must belong to the caller too, or a deal could be built
  // that points at another user's records.
  if (body.lead && !(await ownsContact(auth.userId, body.lead)))
    return notFound("Lead");
  if (body.stage && !(await ownsCrmStage(auth.userId, body.stage)))
    return notFound("Stage");

  try {
    const record = await prisma.crmDeal.create({
      data: {
        leadId: body.lead,
        campaignId: body.campaign,
        stageId: body.stage,
      },
      include: { lead: true, stage: true },
    });

    const { lead, stage, ...rest } = record;
    return NextResponse.json({
      ...rest,
      stage: rest.stageId,
      expand: { lead, stage },
    });
  } catch (error) {
    console.error("[API] Error creating CRM deal:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
