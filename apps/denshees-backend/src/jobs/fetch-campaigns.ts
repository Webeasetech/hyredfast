import { DateTime } from "luxon";
import { prisma } from "../services/prisma.service.js";
import { log } from "../utils/logger.js";
import {
  enqueueEmailBatches,
  getEnqueuedEmailIds,
} from "../queues/batch-email.queue.js";

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
      include: { user: true },
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

    let emailIds = validEmails.map((email: any) => email.id);
    if (emailIds.length === 0) {
      console.log("No valid emails to process.");
      return [];
    }

    // Fetch enqueued email IDs
    const alreadyEnqueuedIds = await getEnqueuedEmailIds();
    emailIds = emailIds.filter((id: any) => !alreadyEnqueuedIds.has(id));

    if (emailIds.length === 0) {
      console.log("No new emails to enqueue (all are already queued).");
      return [];
    }

    console.log("Enqueuing email IDs:", emailIds);
    await enqueueEmailBatches(emailIds);

    return emailIds;
  } catch (error) {
    console.error("Error processing campaign job:", error);
    return [];
  }
}

/**
 * Checks if a campaign is active on the current day based on active_days array.
 * @param {Object} campaign - Campaign object with active_days array.
 * @param {DateTime} currentTime - Current time in the campaign's timezone.
 * @returns {boolean} True if the campaign is active today, false otherwise.
 */
function isCampaignActiveToday(campaign: any, currentTime: DateTime) {
  // If no activeDays specified, assume the campaign is always active
  const activeDays = campaign.activeDays;
  if (!activeDays || !Array.isArray(activeDays) || activeDays.length === 0) {
    return true;
  }

  // Get the current day name in lowercase
  // Luxon weekday: 1=Monday, 2=Tuesday, ..., 7=Sunday
  const dayNames = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const currentDayName = dayNames[currentTime.weekday - 1]; // Convert to 0-based index

  // Check if the current day is in the activeDays array (case-insensitive)
  const activeDaysLowercase = activeDays.map((day: string) =>
    day.toLowerCase(),
  );
  return activeDaysLowercase.includes(currentDayName);
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
 * Determines whether the current time falls within the specified delivery period.
 * @param {DateTime} currentTime - The current time as a Luxon DateTime.
 * @param {string} deliveryPeriod - Delivery period name (e.g., "MORNING", "EVENING").
 * @returns {boolean} True if within the period, false otherwise.
 */
function isWithinDeliveryPeriod(currentTime: DateTime, deliveryPeriod: string) {
  // Ensure deliveryPeriod is a string; if not, log and return false.
  if (typeof deliveryPeriod !== "string") {
    console.warn(`Invalid delivery period: ${deliveryPeriod}`);
    return false;
  }

  const periods: Record<string, { start: number; end: number }> = {
    MORNING: { start: 6, end: 12 }, // 6 AM - 12 PM
    EVENING: { start: 12, end: 18 }, // 12 PM - 6 PM
    NIGHT: { start: 18, end: 24 }, // 6 PM - 12 AM
    MIDNIGHT: { start: 0, end: 6 }, // 12 AM - 6 AM
  };

  const periodKey = deliveryPeriod.toUpperCase();
  const period = periods[periodKey];

  if (!period) {
    console.warn(`Unrecognized delivery period: ${deliveryPeriod}`);
    return false;
  }

  const currentHour = currentTime.hour;
  return currentHour >= period.start && currentHour < period.end;
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
