import { NextResponse } from "next/server";
import { tryAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ACTIVE_LEAD_STATUSES } from "@/lib/constants/lead-status";

/**
 * Per-campaign lead counts for the list rows, in one grouped query rather than
 * a request per row.
 *
 * Grouping by (campaign, status) is what makes a single round trip enough:
 * Prisma cannot express conditional counts, but the per-status breakdown folds
 * into the three figures the list needs.
 *
 * `emailsSent` is the sum of every lead's `stage`, matching the Emails Sent
 * figure on the analytics page — a lead at stage 3 has been sent three emails.
 */
async function leadStatsByCampaign(campaignIds) {
  if (campaignIds.length === 0) return {};

  const groups = await prisma.campaignEmail.groupBy({
    by: ["campaignId", "status"],
    where: { campaignId: { in: campaignIds } },
    _count: { _all: true },
    _sum: { stage: true },
  });

  const stats = {};
  for (const id of campaignIds) {
    stats[id] = { activeLeads: 0, emailsSent: 0, replies: 0 };
  }

  for (const group of groups) {
    const row = stats[group.campaignId];
    if (!row) continue;

    const count = group._count._all;
    row.emailsSent += group._sum.stage || 0;
    if (ACTIVE_LEAD_STATUSES.includes(group.status)) row.activeLeads += count;
    if (group.status === "REPLIED") row.replies += count;
  }

  return stats;
}

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

    const stats = await leadStatsByCampaign(campaigns.map((c) => c.id));

    return NextResponse.json({
      items: campaigns.map((campaign) => ({
        ...campaign,
        ...stats[campaign.id],
      })),
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
