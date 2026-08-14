import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsCampaign, ownsCrmStage, notFound } from "@/lib/authz";

export async function PATCH(request, props) {
  const params = await props.params;
  const stageId = params.id;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;

  const body = await request.json();

  if (!(await ownsCrmStage(auth.userId, stageId))) return notFound("Stage");
  if (
    body.campaign !== undefined &&
    !(await ownsCampaign(auth.userId, body.campaign))
  )
    return notFound("Campaign");

  try {
    const data = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.order !== undefined) data.order = body.order;
    if (body.color !== undefined) data.color = body.color;
    if (body.is_won !== undefined) data.isWon = body.is_won;
    if (body.is_lost !== undefined) data.isLost = body.is_lost;
    if (body.campaign !== undefined) data.campaignId = body.campaign;

    const record = await prisma.crmStage.update({
      where: { id: stageId },
      data,
    });
    return NextResponse.json({
      ...record,
      is_won: record.isWon,
      is_lost: record.isLost,
    });
  } catch (error) {
    console.error(`[API] Error updating CRM stage ${stageId}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, props) {
  const params = await props.params;
  const stageId = params.id;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;

  if (!(await ownsCrmStage(auth.userId, stageId))) return notFound("Stage");

  try {
    await prisma.crmStage.delete({ where: { id: stageId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[API] Error deleting CRM stage ${stageId}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
