import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import {
  ownsCampaign,
  ownsContact,
  ownsCrmDeal,
  ownsCrmStage,
  notFound,
} from "@/lib/authz";

export async function PATCH(request, props) {
  const params = await props.params;
  const dealId = params.id;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;

  const body = await request.json();

  if (!(await ownsCrmDeal(auth.userId, dealId))) return notFound("Deal");
  // Each id in the payload is checked as well, so a deal cannot be re-pointed
  // at another user's campaign, lead or stage.
  if (
    body.campaign !== undefined &&
    !(await ownsCampaign(auth.userId, body.campaign))
  )
    return notFound("Campaign");
  if (body.lead !== undefined && !(await ownsContact(auth.userId, body.lead)))
    return notFound("Lead");
  if (
    body.stage !== undefined &&
    !(await ownsCrmStage(auth.userId, body.stage))
  )
    return notFound("Stage");

  try {
    const data = {};
    if (body.lead !== undefined) data.leadId = body.lead;
    if (body.campaign !== undefined) data.campaignId = body.campaign;
    if (body.stage !== undefined) data.stageId = body.stage;

    const record = await prisma.crmDeal.update({
      where: { id: dealId },
      data,
      include: { lead: true, stage: true },
    });

    const { lead, stage, ...rest } = record;
    return NextResponse.json({
      ...rest,
      stage: rest.stageId,
      expand: { lead, stage },
    });
  } catch (error) {
    console.error(`[API] Error updating CRM deal ${dealId}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, props) {
  const params = await props.params;
  const dealId = params.id;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;

  if (!(await ownsCrmDeal(auth.userId, dealId))) return notFound("Deal");

  try {
    await prisma.crmDeal.delete({ where: { id: dealId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[API] Error deleting CRM deal ${dealId}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
