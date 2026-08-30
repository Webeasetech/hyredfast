import { NextResponse } from "next/server";
import { tryAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/analysis/campaign/[id]/daily-stats
 *
 * Returns aggregated daily stats for this campaign, oldest day first.
 * Powers the calendar heat-map and the Daily Activity chart without fetching
 * individual activities. Only days with messages appear, so the series is
 * sparse rather than gap-filled.
 */
export async function GET(request, props) {
  const params = await props.params;
  try {
    const { id } = params;
    const { auth: currUser, response: authResponse } = tryAuth(request);
    if (authResponse) return authResponse;
    if (!currUser?.userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    // Verify campaign ownership
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign || campaign.userId !== currUser.userId) {
      return NextResponse.json(
        { error: "Unauthorized access to campaign" },
        { status: 403 },
      );
    }

    // Aggregate daily stats from campaign_messages and email_opens
    // Using raw SQL for date grouping since Prisma groupBy doesn't support date truncation natively
    //
    // Raw SQL, so these are real table and column names rather than Prisma
    // fields — they have to be updated by hand whenever the schema is renamed.
    const dailyStats = await prisma.$queryRaw`
      WITH msg_stats AS (
        SELECT
          DATE(cm.created) as day,
          COUNT(*) FILTER (WHERE cm.sent = true) as sent,
          COUNT(*) FILTER (WHERE cm.sent = false) as replies
        FROM campaign_messages cm
        JOIN campaign_leads cl ON cm.campaign_lead_id = cl.id
        WHERE cl.campaign_id = ${id}
        GROUP BY DATE(cm.created)
      ),
      open_stats AS (
        SELECT
          DATE(eo.created) as day,
          COUNT(*) as opens
        FROM email_opens eo
        JOIN campaign_leads cl ON eo.campaign_lead_id = cl.id
        WHERE cl.campaign_id = ${id}
        GROUP BY DATE(eo.created)
      )
      SELECT
        ms.day,
        ${id}::text as campaign,
        COALESCE(ms.sent, 0) as sent,
        COALESCE(ms.replies, 0) as replies,
        COALESCE(os.opens, 0) as opens
      FROM msg_stats ms
      LEFT JOIN open_stats os ON ms.day = os.day
      ORDER BY ms.day ASC
    `;

    // Format to match the old PB view shape
    const stats = dailyStats.map((row) => ({
      campaign: id,
      day: row.day,
      sent: Number(row.sent),
      replies: Number(row.replies),
      opens: Number(row.opens),
    }));

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Error fetching daily stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch daily stats" },
      { status: 500 },
    );
  }
}
