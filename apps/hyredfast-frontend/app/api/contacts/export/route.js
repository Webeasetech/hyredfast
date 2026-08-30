import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsCampaign, notFound } from "@/lib/authz";
import { buildLeadsFilter } from "@/lib/leads-filter";

export async function GET(request) {
  const searchParams = new URL(request.url).searchParams;
  const campaign = searchParams.get("campaign");
  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsCampaign(auth.userId, campaign))) return notFound("Campaign");

  try {
    const { where, orderBy } = buildLeadsFilter(searchParams);

    const records = await prisma.campaignLead.findMany({ where, orderBy });

    return NextResponse.json({ items: records });
  } catch (error) {
    console.error(
      `[API] Error exporting contacts for campaign ${campaign}:`,
      error,
    );
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
