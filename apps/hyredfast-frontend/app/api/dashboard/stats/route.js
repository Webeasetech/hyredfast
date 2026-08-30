import { NextResponse } from "next/server";
import { tryAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
const revalidate = 0;

export async function GET(request) {
  try {
    const { auth: currUser, response: authResponse } = tryAuth(request);
    if (authResponse) return authResponse;
    if (!currUser?.userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    const userId = currUser.userId;

    // Compute dashboard stats via aggregates
    const [totalContacts, totalCampaigns, emailsSent, responses] =
      await Promise.all([
        prisma.campaignLead.count({
          where: { campaign: { userId, deleted: false } },
        }),
        prisma.campaign.count({
          where: { userId, deleted: false },
        }),
        prisma.campaignMessage.count({
          where: {
            sent: true,
            campaignLead: { campaign: { userId, deleted: false } },
          },
        }),
        prisma.campaignMessage.count({
          where: {
            sent: false,
            campaignLead: { campaign: { userId, deleted: false } },
          },
        }),
      ]);

    // Fetch recent campaigns (limit to 6)
    const recentCampaigns = await prisma.campaign.findMany({
      where: { userId, deleted: false },
      orderBy: { created: "desc" },
      take: 6,
    });

    // For each recent campaign, compute stats
    const formattedRecentCampaigns = await Promise.all(
      recentCampaigns.map(async (campaign) => {
        const [stagesSum, openedSum] = await Promise.all([
          prisma.campaignLead
            .aggregate({
              where: { campaignId: campaign.id },
              _sum: { stage: true },
            })
            .then((r) => r._sum.stage || 0),
          prisma.campaignLead
            .aggregate({
              where: { campaignId: campaign.id },
              _sum: { openCount: true },
            })
            .then((r) => r._sum.openCount || 0),
        ]);
        return {
          id: campaign.id,
          title: campaign.title,
          emailsSent: stagesSum,
          openRate: openedSum,
        };
      }),
    );

    // Fetch recent activities
    const activities = [];

    // 1. Recent email sends
    try {
      const recentSends = await prisma.campaignMessage.findMany({
        where: {
          sent: true,
          campaignLead: { campaign: { userId, deleted: false } },
        },
        orderBy: { created: "desc" },
        take: 2,
        include: {
          campaignLead: { include: { campaign: true } },
        },
      });

      recentSends.forEach((message) => {
        const ce = message.campaignLead;
        activities.push({
          type: "Email sent",
          timestamp: message.created,
          details: formatRecipientDetails(ce),
          campaignId: ce?.campaign?.id,
          campaignTitle: ce?.campaign?.title || "Unknown campaign",
          recipientName: ce?.name || "",
          recipientEmail: ce?.email || "",
        });
      });
    } catch (error) {
      console.error("Error fetching recent sends:", error);
    }

    // 2. Recent email opens
    try {
      const recentOpens = await prisma.emailOpen.findMany({
        where: {
          campaignLead: { campaign: { userId, deleted: false } },
        },
        orderBy: { created: "desc" },
        take: 1,
        include: {
          campaignLead: { include: { campaign: true } },
        },
      });

      recentOpens.forEach((open) => {
        const ce = open.campaignLead;
        activities.push({
          type: "Email opened",
          timestamp: open.created,
          details: formatRecipientDetails(ce),
          campaignId: ce?.campaign?.id,
          campaignTitle: ce?.campaign?.title || "Unknown campaign",
          recipientName: ce?.name || "",
          recipientEmail: ce?.email || "",
        });
      });
    } catch (error) {
      console.error("Error fetching recent opens:", error);
    }

    // 3. Recent replies
    try {
      const recentReplies = await prisma.campaignMessage.findMany({
        where: {
          sent: false,
          campaignLead: { campaign: { userId, deleted: false } },
        },
        orderBy: { created: "desc" },
        take: 2,
        include: {
          campaignLead: { include: { campaign: true } },
        },
      });

      recentReplies.forEach((message) => {
        const ce = message.campaignLead;
        activities.push({
          type: "Reply received",
          timestamp: message.created,
          details: formatRecipientDetails(ce),
          campaignId: ce?.campaign?.id,
          campaignTitle: ce?.campaign?.title || "Unknown campaign",
          recipientName: ce?.name || "",
          recipientEmail: ce?.email || "",
        });
      });
    } catch (error) {
      console.error("Error fetching recent replies:", error);
    }

    // Sort all activities by timestamp (most recent first) and limit to 10
    const recentActivities = activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);

    return NextResponse.json({
      stats: {
        total_contacts: totalContacts,
        total_campaigns: totalCampaigns,
        emails_sent: emailsSent,
        responses: responses,
      },
      recent_campaigns: formattedRecentCampaigns,
      recent_activities: recentActivities,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 },
    );
  }
}

function formatRecipientDetails(campaignLead) {
  if (!campaignLead) return "Unknown recipient";
  const name = campaignLead.name;
  const email = campaignLead.email;
  if (name && email) return `${name} (${email})`;
  if (email) return email;
  if (name) return name;
  return "Unknown recipient";
}
