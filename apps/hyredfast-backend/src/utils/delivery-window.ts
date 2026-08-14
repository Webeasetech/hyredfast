/**
 * Delivery window rules, shared by the scheduler and the sender.
 *
 * The scheduler decides what to enqueue, the batch job decides what may still
 * go out when it gets there. Both have to agree on what "inside the window"
 * means, so the rules live here rather than in either caller.
 */

import { DateTime } from "luxon";

/** Delivery periods as local hour ranges, start inclusive and end exclusive. */
export const DELIVERY_PERIODS: Record<string, { start: number; end: number }> = {
  MORNING: { start: 6, end: 12 }, // 6 AM - 12 PM
  EVENING: { start: 12, end: 18 }, // 12 PM - 6 PM
  NIGHT: { start: 18, end: 24 }, // 6 PM - 12 AM
  MIDNIGHT: { start: 0, end: 6 }, // 12 AM - 6 AM
};

/**
 * Checks if a campaign is active on the current day based on active_days array.
 * @param {Object} campaign - Campaign object with active_days array.
 * @param {DateTime} currentTime - Current time in the campaign's timezone.
 * @returns {boolean} True if the campaign is active today, false otherwise.
 */
export function isCampaignActiveToday(campaign: any, currentTime: DateTime) {
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
 * Determines whether the current time falls within the specified delivery period.
 * @param {DateTime} currentTime - The current time as a Luxon DateTime.
 * @param {string} deliveryPeriod - Delivery period name (e.g., "MORNING", "EVENING").
 * @returns {boolean} True if within the period, false otherwise.
 */
export function isWithinDeliveryPeriod(
  currentTime: DateTime,
  deliveryPeriod: string,
) {
  // Ensure deliveryPeriod is a string; if not, log and return false.
  if (typeof deliveryPeriod !== "string") {
    console.warn(`Invalid delivery period: ${deliveryPeriod}`);
    return false;
  }

  const periodKey = deliveryPeriod.toUpperCase();
  const period = DELIVERY_PERIODS[periodKey];

  if (!period) {
    console.warn(`Unrecognized delivery period: ${deliveryPeriod}`);
    return false;
  }

  const currentHour = currentTime.hour;
  return currentHour >= period.start && currentHour < period.end;
}

/**
 * Whether a campaign may send right now: the owner's timezone is usable, today
 * is one of its active days, and the local hour is inside its delivery period.
 *
 * @param {Object} campaign - Campaign object with its user joined.
 * @returns {boolean} True when a send is allowed at this moment.
 */
export function isWithinDeliveryWindow(campaign: any) {
  if (!campaign?.user?.timezone || !campaign.emailDeliveryPeriod) return false;

  const currentTime = DateTime.now().setZone(campaign.user.timezone);
  if (!currentTime.isValid) return false;

  return (
    isCampaignActiveToday(campaign, currentTime) &&
    isWithinDeliveryPeriod(currentTime, campaign.emailDeliveryPeriod)
  );
}
