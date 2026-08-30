import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsCampaign, notFound } from "@/lib/authz";

/**
 * Get-or-create the draft for a campaign.
 *
 * There is exactly one draft per campaign (enforced by a unique index, not just
 * here), which is what makes reopening the composer the entire resume
 * mechanism — no drafts list to browse, no draft picker.
 *
 * The grid's columns are not part of this response. They are the variables the
 * campaign's pitches reference, read live from `/api/pitches`, so editing a
 * template changes what the grid asks for straight away.
 */
export async function GET(request) {
  const searchParams = new URL(request.url).searchParams;
  const campaign = searchParams.get("campaign");

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsCampaign(auth.userId, campaign))) return notFound("Campaign");

  try {
    let draft = await prisma.leadDraft.findUnique({
      where: { campaignId: campaign },
      include: { rows: { orderBy: { position: "asc" } } },
    });

    if (!draft) {
      draft = await prisma.leadDraft.create({
        data: { campaignId: campaign, userId: auth.userId },
        include: { rows: true },
      });
    }

    return NextResponse.json(draft);
  } catch (error) {
    console.error(
      `[API] Error loading lead draft for campaign ${campaign}:`,
      error,
    );
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
