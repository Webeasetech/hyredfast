import { NextResponse } from "next/server";
import { tryAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { activeCampaignWhere } from "@/lib/credential-usage";

export async function GET(request) {
  try {
    const { auth: user, response: authResponse } = tryAuth(request);
    if (authResponse) return authResponse;
    const records = await prisma.emailCredential.findMany({
      where: { userId: user.userId },
      // Never select `password` / `imapPassword`. Nothing downstream needs
      // them: the UI only ever writes credentials, and the agent's
      // list_email_credentials tool json.dumps this straight into an LLM
      // prompt — so an unfiltered row put SMTP passwords in front of OpenAI
      // and into LangSmith traces on every call.
      select: {
        id: true,
        username: true,
        host: true,
        port: true,
        secure: true,
        status: true,
        imapEmail: true,
        imapHost: true,
        dailyLimit: true,
        lastCheckedTime: true,
        created: true,
        updated: true,
      },
    });

    // Count active campaigns each credential is selected in, so the UI can
    // decide whether it is safe to delete without an extra round-trip.
    const activeJoins = await prisma.campaignEmailCredential.findMany({
      where: {
        emailCredentialId: { in: records.map((r) => r.id) },
        ...activeCampaignWhere(),
      },
      select: { emailCredentialId: true },
    });

    const activeCounts = activeJoins.reduce((acc, join) => {
      acc[join.emailCredentialId] = (acc[join.emailCredentialId] || 0) + 1;
      return acc;
    }, {});

    const withUsage = records.map((record) => ({
      ...record,
      activeCampaignCount: activeCounts[record.id] || 0,
    }));

    return NextResponse.json(withUsage);
  } catch (error) {
    console.error("[API] Error getting email credentials:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
