import { DateTime } from "luxon";
import { prisma } from "../services/prisma.service.js";
import { log } from "../utils/logger.js";
import {
  isCampaignActiveToday,
  isWithinDeliveryPeriod,
} from "../utils/delivery-window.js";
import { credentialSendBudget } from "../utils/send-capacity.js";
import { getCredentialSentCount } from "../services/credential-service.js";
import { enqueueEmails } from "../queues/batch-email.queue.js";

/**
 * Processes the campaign job by fetching campaigns and their emails,
 * filtering based on delivery time, credits, and send delay, then enqueues email batches.
 * @returns {Promise<Array>} List of processed email IDs or an empty array on error.
 */
async function processCampaignJob() {
  try {
    // Fetch all non-deleted campaigns with a user
    const campaigns = await prisma.campaign.findMany({
      where: {
        deleted: false,
        userId: { not: null },
      },
      include: {
        user: true,
        campaignEmailCredentials: { include: { emailCredential: true } },
      },
    });

    if (campaigns.length === 0) {
      console.log("No campaigns found.");
      return [];
    }

    // Filter campaigns based on delivery period and available credits
    const skipCounts: Record<string, number> = {};
    const validCampaigns = campaigns.filter((campaign: any) => {
      const reason = campaignSkipReason(campaign);
      if (!reason) return true;
      skipCounts[reason] = (skipCounts[reason] ?? 0) + 1;
      return false;
    });

    log("INFO", "Campaign scheduling pass complete", "", {
      considered: campaigns.length,
      eligible: validCampaigns.length,
      skipped: skipCounts,
    });

    // The campaignEmail query below does not join the user, so carry each
    // campaign's timezone across from the campaigns we already loaded.
    const campaignTimezones = new Map<string, string>(
      validCampaigns.map((c: any) => [c.id, c.user.timezone]),
    );

    // Extract campaign IDs from valid campaigns
    const campaignIds = validCampaigns.map((c: any) => c.id);
    if (campaignIds.length === 0) {
      console.log(
        "No valid campaigns found based on delivery time and credits.",
      );
      return [];
    }

    // Fetch all emails belonging to valid campaigns with RUNNING status,
    // where email status is PENDING or RUNNING (excluding REPLIED and BOUNCED)
    const campaignEmails = await prisma.campaignEmail.findMany({
      where: {
        campaignId: { in: campaignIds },
        campaign: { status: "RUNNING" },
        status: { in: ["PENDING", "RUNNING"] },
        NOT: [{ status: "REPLIED" }, { status: "BOUNCED" }],
      },
      include: { campaign: { include: { pitches: true } } },
      orderBy: { stage: "asc" },
    });

    // Filter emails based on the send delay (if any)
    // Stage 0 (fresh leads) should always be sent immediately, regardless of sent_at.
    // For follow-ups, use the per-stage delay from the matching pitch, falling back
    // to the campaign-wide daysInterval when a pitch has no explicit delay.
    const validEmails = campaignEmails.filter((email: any) => {
      if (isKnownBadAddress(email)) return false;

      if (email.stage === 0) return true;

      const stagePitch = email.campaign?.pitches?.find(
        (p: any) => p.stage === email.stage,
      );
      const delay =
        stagePitch?.delayDays ?? email.campaign?.daysInterval ?? 0;

      const timezone = campaignTimezones.get(email.campaignId) ?? "UTC";

      return shouldSendToday(
        email.sentAt?.toISOString() ?? null,
        delay,
        timezone,
      );
    });

    if (validEmails.length === 0) {
      console.log("No valid emails to process.");
      return [];
    }

    const emailIds = await selectWithinCapacity(validCampaigns, validEmails);
    if (emailIds.length === 0) {
      console.log("No sending capacity left in the window.");
      return [];
    }

    log("INFO", "Enqueuing within window capacity", "", {
      eligible: validEmails.length,
      enqueued: emailIds.length,
      heldBack: validEmails.length - emailIds.length,
    });

    // Rows already in flight are offered again on purpose. The queue keys each
    // job on the email id and rejects the repeats, which is what a scheduler
    // tick after a restart relies on.
    await enqueueEmails(emailIds);

    return emailIds;
  } catch (error) {
    console.error("Error processing campaign job:", error);
    return [];
  }
}

/**
 * Whether verification has already said this address is bad.
 *
 * Only an explicit FAILED is held back. PENDING is the default every imported
 * contact carries and nothing in the app moves a row off it yet, so treating
 * "not verified" as "do not send" would stop every campaign from sending.
 * Once verification results are persisted this can tighten to require VERIFIED.
 *
 * @param {Object} email - Campaign email with its campaign joined.
 * @returns {boolean} True when the address should be skipped.
 */
function isKnownBadAddress(email: any): boolean {
  if (email.campaign?.ignoreVerification) return false;

  return email.verified === "FAILED";
}

/**
 * Trims the eligible emails down to what can actually go out, and orders them
 * so no single user's backlog is enqueued ahead of everybody else's.
 *
 * Each campaign gets what its own mailboxes can send before the window closes.
 * Anything past that would only wake, miss the credential lock and requeue
 * until the window shut, so it is left for a later pass instead.
 *
 * @param {Array} validCampaigns - Campaigns cleared to send, credentials joined.
 * @param {Array} validEmails - Emails whose delay has elapsed.
 * @returns {Promise<Array<string>>} Email IDs to enqueue, in send order.
 */
async function selectWithinCapacity(
  validCampaigns: any[],
  validEmails: any[],
): Promise<string[]> {
  const credentialIds = [
    ...new Set(validCampaigns.flatMap(credentialIdsOf)),
  ] as string[];

  const sentToday = new Map<string, number>(
    await Promise.all(
      credentialIds.map(
        async (credId) =>
          [credId, await getCredentialSentCount(credId)] as [string, number],
      ),
    ),
  );

  // One mailbox can serve several campaigns, so the budget is held per
  // credential and spent once, not handed to each campaign in full.
  const budgets = new Map<string, number>();
  for (const campaign of validCampaigns) {
    const currentTime = DateTime.now().setZone(campaign.user.timezone);

    for (const credId of credentialIdsOf(campaign)) {
      const credential = campaign.campaignEmailCredentials.find(
        (cec: any) => cec.emailCredential?.id === credId,
      ).emailCredential;

      const budget = credentialSendBudget(
        credential,
        currentTime,
        campaign.emailDeliveryPeriod,
        sentToday,
      );

      budgets.set(credId, Math.max(budgets.get(credId) ?? 0, budget));
    }
  }

  const emailsByCampaign = new Map<string, any[]>();
  for (const email of validEmails) {
    const forCampaign = emailsByCampaign.get(email.campaignId) ?? [];
    forCampaign.push(email);
    emailsByCampaign.set(email.campaignId, forCampaign);
  }

  const idsByUser = new Map<string, string[]>();
  for (const campaign of validCampaigns) {
    const credIds = credentialIdsOf(campaign);
    const capacity = credIds.reduce(
      (total, credId) => total + (budgets.get(credId) ?? 0),
      0,
    );
    if (capacity === 0) continue;

    // A follow-up is due on a calendar date and slips a whole cycle if it
    // misses today. A new lead has no date attached, so it gives way.
    const selected = (emailsByCampaign.get(campaign.id) ?? [])
      .sort((a: any, b: any) => (b.stage ?? 0) - (a.stage ?? 0))
      .slice(0, capacity)
      .map((email: any) => email.id);

    spendBudget(budgets, credIds, selected.length);

    const forUser = idsByUser.get(campaign.userId) ?? [];
    idsByUser.set(campaign.userId, forUser.concat(selected));
  }

  return interleave([...idsByUser.values()]);
}

/**
 * Credential IDs attached to a campaign.
 * @param {Object} campaign - Campaign with its credentials joined.
 * @returns {Array<string>} Credential IDs.
 */
function credentialIdsOf(campaign: any): string[] {
  return (campaign.campaignEmailCredentials ?? [])
    .map((cec: any) => cec.emailCredential?.id)
    .filter(Boolean);
}

/**
 * Draws a campaign's allocation from its mailboxes, filling each in turn.
 *
 * Which mailbox actually sends a given email is decided later, at send time,
 * so this only has to keep the totals honest across campaigns sharing one.
 *
 * @param {Map<string, number>} budgets - Remaining sends per credential id.
 * @param {Array<string>} credIds - Credentials the campaign can draw on.
 * @param {number} count - Emails allocated to the campaign.
 */
function spendBudget(
  budgets: Map<string, number>,
  credIds: string[],
  count: number,
): void {
  let left = count;

  for (const credId of credIds) {
    if (left === 0) break;

    const available = budgets.get(credId) ?? 0;
    const spent = Math.min(available, left);

    budgets.set(credId, available - spent);
    left -= spent;
  }
}

/**
 * Takes one item from each list in turn, so every user is represented at the
 * front of the queue rather than whoever imported leads first.
 *
 * @param {Array<Array<string>>} lists - One list of email IDs per user.
 * @returns {Array<string>} Flattened, round-robin ordered IDs.
 */
function interleave(lists: string[][]): string[] {
  const ordered: string[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));

  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      if (i < list.length) ordered.push(list[i]);
    }
  }

  return ordered;
}

/**
 * Explains why a campaign is not eligible to send right now.
 *
 * Misconfiguration (no timezone, unusable timezone, no delivery period) and an
 * empty credit balance are logged at WARN because they block the campaign until
 * somebody acts. Being outside the delivery window or off an active day is
 * normal for most of the day and is only counted, not logged per campaign.
 *
 * @param {Object} campaign - Campaign object with its user joined.
 * @returns {string|null} Skip reason, or null when the campaign may send.
 */
function campaignSkipReason(campaign: any): string | null {
  try {
    if (!campaign) return "missing_campaign";

    if (!campaign.user?.timezone) {
      log("WARN", "Campaign skipped: user has no timezone set", campaign.id, {
        campaignId: campaign.id,
        userId: campaign.user?.id,
      });
      return "no_timezone";
    }

    if (!campaign.emailDeliveryPeriod) {
      log("WARN", "Campaign skipped: no delivery period set", campaign.id, {
        campaignId: campaign.id,
        userId: campaign.user?.id,
      });
      return "no_delivery_period";
    }

    if (!campaign.campaignEmailCredentials?.length) {
      log("WARN", "Campaign skipped: no sending credentials", campaign.id, {
        campaignId: campaign.id,
        userId: campaign.user?.id,
      });
      return "no_credentials";
    }

    // Use Luxon to get the current time in the campaign's timezone
    const currentTime = DateTime.now().setZone(campaign.user.timezone);

    if (!currentTime.isValid) {
      log("WARN", "Campaign skipped: timezone is not a valid IANA zone", campaign.id, {
        campaignId: campaign.id,
        userId: campaign.user?.id,
        timezone: campaign.user.timezone,
      });
      return "invalid_timezone";
    }

    if ((campaign.user?.credits ?? 0) <= 0) {
      log("WARN", "Campaign skipped: user has no credits left", campaign.id, {
        campaignId: campaign.id,
        userId: campaign.user?.id,
      });
      return "no_credits";
    }

    if (!isCampaignActiveToday(campaign, currentTime)) {
      return "inactive_day";
    }

    if (!isWithinDeliveryPeriod(currentTime, campaign.emailDeliveryPeriod)) {
      return "outside_delivery_window";
    }

    return null;
  } catch (error: any) {
    log("ERROR", "Error checking campaign eligibility", campaign?.id, {
      campaignId: campaign?.id,
      error: error.message,
    });
    return "check_failed";
  }
}

/**
 * Determines if an email should be sent today based on its last sent date and delay.
 * @param {string|null} sentAt - ISO date string of when the email was last sent.
 * @param {number} delay - Minimum number of days between sends.
 * @param {string} timezone - IANA timezone of the campaign's owner.
 * @returns {boolean} True if the email should be sent, false otherwise.
 */
function shouldSendToday(
  sentAt: string | null,
  delay: number,
  timezone: string,
) {
  // If no sent date is available, send immediately.
  if (!sentAt) return true;
  try {
    return daysPassed(sentAt, timezone) >= delay;
  } catch (error) {
    console.error("Error determining if email should be sent today:", error);
    return false;
  }
}

/**
 * Counts calendar days between the send date and today, both read in the user's
 * timezone. A delay is a date difference, not elapsed time: sent on the 5th with
 * a 2 day delay means eligible anywhere inside the window on the 7th, whatever
 * hour the parent went out at.
 *
 * @param {string} isoDateString - ISO formatted date string.
 * @param {string} timezone - IANA timezone the day boundary is measured in.
 * @returns {number} Number of calendar days passed.
 * @throws Will throw an error if the date or the timezone is invalid.
 */
function daysPassed(isoDateString: string, timezone: string) {
  const sentDay = DateTime.fromISO(isoDateString, {
    zone: timezone,
  }).startOf("day");

  if (!sentDay.isValid) {
    throw new Error(
      `Invalid date or timezone: ${isoDateString} / ${timezone}`,
    );
  }

  const today = DateTime.now().setZone(timezone).startOf("day");

  return Math.floor(today.diff(sentDay, "days").days);
}

export { processCampaignJob };
