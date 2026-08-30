import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";

// Non-secret credential fields. `password` / `imapPassword` must never leave
// the database — this route used to return whole EmailCredential rows, and it
// did so without authenticating at all.
const CREDENTIAL_FIELDS = {
  id: true,
  username: true,
  host: true,
  port: true,
  secure: true,
  status: true,
  imapEmail: true,
  imapHost: true,
  dailyLimit: true,
};

export async function GET(request, props) {
  const params = await props.params;
  const { id } = params;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;

  try {
    // Scoped by userId, not just id: authenticating alone would still let any
    // signed-in user read any other user's campaign by guessing its id.
    const record = await prisma.campaign.findFirst({
      where: { id, userId: auth.userId },
      include: {
        campaignEmailCredentials: {
          include: { emailCredential: { select: CREDENTIAL_FIELDS } },
        },
      },
    });

    if (!record) {
      return NextResponse.json(
        { message: "Campaign not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error(`[API] Error getting campaign ${id}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, props) {
  const params = await props.params;
  const { id } = params;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;

  const {
    setupComplete,
    title,
    max_stage_count,
    days_interval,
    desc,
    status,
    ignore_verification,
    deleted,
    emails,
    isTrackingEnabled,
    active_days,
    email_delivery_period,
  } = await request.json();

  try {
    const owned = await prisma.campaign.findFirst({
      where: { id, userId: auth.userId },
      select: { id: true },
    });

    if (!owned) {
      return NextResponse.json(
        { message: "Campaign not found" },
        { status: 404 },
      );
    }

    const data = {};
    if (setupComplete !== undefined) data.setupComplete = setupComplete;
    if (title !== undefined) data.title = title;
    if (max_stage_count !== undefined) data.maxStageCount = max_stage_count;
    if (days_interval !== undefined) data.daysInterval = days_interval;
    if (desc !== undefined) data.desc = desc;
    if (status !== undefined) data.status = status;
    if (ignore_verification !== undefined)
      data.ignoreVerification = ignore_verification;
    if (deleted !== undefined) data.deleted = deleted;
    if (isTrackingEnabled !== undefined)
      data.isTrackingEnabled = isTrackingEnabled;
    if (active_days !== undefined) data.activeDays = active_days;
    if (email_delivery_period !== undefined)
      data.emailDeliveryPeriod = email_delivery_period;

    const record = await prisma.campaign.update({
      where: { id },
      data,
    });

    // Handle multi-relation emails update
    if (emails !== undefined && Array.isArray(emails)) {
      // Only credentials the caller actually owns, so a crafted payload can't
      // attach someone else's mailbox to this campaign.
      const ownedCredentials = await prisma.emailCredential.findMany({
        where: { id: { in: emails }, userId: auth.userId },
        select: { id: true },
      });

      await prisma.campaignEmailCredential.deleteMany({
        where: { campaignId: id },
      });
      for (const cred of ownedCredentials) {
        await prisma.campaignEmailCredential.create({
          data: { campaignId: id, emailCredentialId: cred.id },
        });
      }
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error(`[API] Error updating campaign ${id}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
