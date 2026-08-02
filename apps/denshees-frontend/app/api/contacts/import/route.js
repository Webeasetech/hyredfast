import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsCampaign, notFound } from "@/lib/authz";

export async function POST(request) {
  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;

  const { contacts, campaign } = await request.json();

  if (!(await ownsCampaign(auth.userId, campaign))) return notFound("Campaign");

  try {
    const created = await prisma.campaignEmail.createMany({
      data: contacts.map((c) => ({
        name: c.name,
        email: c.email,
        campaignId: campaign,
        status: "PENDING",
        sentAt: new Date(),
        opened: 0,
        stage: 0,
        personalization: c.personalization || undefined,
      })),
    });

    return NextResponse.json({
      message: "Contacts imported",
      count: created.count,
    });
  } catch (error) {
    console.error(
      `[API] Error importing contacts for campaign ${campaign}:`,
      error,
    );
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
