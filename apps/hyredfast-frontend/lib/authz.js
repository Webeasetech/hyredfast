import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Ownership checks.
 *
 * Authentication only establishes *who* is calling. Almost every route here
 * takes a record id from the request, so without a second check any signed-in
 * user could read or edit another user's data just by knowing an id. These
 * helpers answer "does this record belong to the caller?".
 *
 * Only Campaign, LeadList and Lead carry a userId; everything else (pitches,
 * CRM stages/deals/activities, contacts) hangs off a campaign, so ownership is
 * resolved through it.
 */

/** 404 rather than 403 — don't confirm that someone else's record exists. */
export function notFound(what = "Record") {
  return NextResponse.json({ message: `${what} not found` }, { status: 404 });
}

export async function ownsCampaign(userId, campaignId) {
  if (!campaignId) return false;
  const found = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
    select: { id: true },
  });
  return !!found;
}

export async function ownsLeadList(userId, leadListId) {
  if (!leadListId) return false;
  const found = await prisma.leadList.findFirst({
    where: { id: leadListId, userId },
    select: { id: true },
  });
  return !!found;
}

export async function ownsLeadListItem(userId, itemId) {
  if (!itemId) return false;
  const found = await prisma.leadListItem.findFirst({
    where: { id: itemId, leadList: { userId } },
    select: { id: true },
  });
  return !!found;
}

/** Lead carries userId directly (the pre-campaign repository). */
export async function ownsLead(userId, leadId) {
  if (!leadId) return false;
  const found = await prisma.savedLead.findFirst({
    where: { id: leadId, userId },
    select: { id: true },
  });
  return !!found;
}

/** LeadDraft — the composer's staging area. Scoped via its campaign. */
export async function ownsLeadDraft(userId, draftId) {
  if (!draftId) return false;
  const found = await prisma.leadDraft.findFirst({
    where: { id: draftId, campaign: { userId } },
    select: { id: true },
  });
  return !!found;
}

/** A single row inside a draft. Scoped via the draft's campaign. */
export async function ownsLeadDraftRow(userId, rowId) {
  if (!rowId) return false;
  const found = await prisma.leadDraftRow.findFirst({
    where: { id: rowId, draft: { campaign: { userId } } },
    select: { id: true },
  });
  return !!found;
}

/** CampaignLead — a contact inside a campaign. Scoped via its campaign. */
export async function ownsContact(userId, contactId) {
  if (!contactId) return false;
  const found = await prisma.campaignLead.findFirst({
    where: { id: contactId, campaign: { userId } },
    select: { id: true },
  });
  return !!found;
}

export async function ownsCredential(userId, credentialId) {
  if (!credentialId) return false;
  const found = await prisma.emailCredential.findFirst({
    where: { id: credentialId, userId },
    select: { id: true },
  });
  return !!found;
}

export async function ownsPitch(userId, pitchId) {
  if (!pitchId) return false;
  const found = await prisma.pitchTemplate.findFirst({
    where: { id: pitchId, campaign: { userId } },
    select: { id: true },
  });
  return !!found;
}

export async function ownsCrmStage(userId, stageId) {
  if (!stageId) return false;
  const found = await prisma.crmStage.findFirst({
    where: { id: stageId, campaign: { userId } },
    select: { id: true },
  });
  return !!found;
}

export async function ownsCrmDeal(userId, dealId) {
  if (!dealId) return false;
  const found = await prisma.crmDeal.findFirst({
    where: { id: dealId, campaign: { userId } },
    select: { id: true },
  });
  return !!found;
}
