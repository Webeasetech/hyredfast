/**
 * How much a campaign can actually send before its window closes.
 *
 * Sends are paced per mailbox by the credential lock, so capacity is not a
 * platform number: it is one send per SEND_SPACING_SECONDS per credential, for
 * as long as the window stays open and the mailbox has daily allowance left.
 *
 * The scheduler uses this to stop queueing what physically cannot go out.
 * Anything queued past the limit would just wake, miss the lock, and requeue
 * until the window closed.
 */

import { DateTime } from "luxon";
import { DELIVERY_PERIODS } from "./delivery-window.js";
import { SEND_SPACING_SECONDS } from "./send-lock.js";

const SCHEDULER_TICK_SECONDS = 15 * 60;

// Queue two ticks ahead. One tick would leave a mailbox idle whenever a tick
// runs late, and a full window would rebuild the backlog this exists to avoid.
const QUEUE_HORIZON_SECONDS = SCHEDULER_TICK_SECONDS * 2;

/**
 * Seconds until the campaign's delivery period closes.
 * @param {DateTime} currentTime - Current time in the campaign owner's timezone.
 * @param {string} deliveryPeriod - Delivery period name.
 * @returns {number} Seconds remaining, 0 once the window has closed.
 */
export function secondsLeftInWindow(
  currentTime: DateTime,
  deliveryPeriod: string,
): number {
  if (typeof deliveryPeriod !== "string") return 0;

  const period = DELIVERY_PERIODS[deliveryPeriod.toUpperCase()];
  if (!period) return 0;

  const closesAt = currentTime.startOf("day").plus({ hours: period.end });

  return Math.max(0, Math.floor(closesAt.diff(currentTime, "seconds").seconds));
}

/**
 * How many sends one mailbox has left this pass.
 *
 * Budgets belong to the credential rather than the campaign, because the same
 * mailbox can be attached to several campaigns and they all draw on it.
 *
 * @param {Object} credential - Email credential.
 * @param {DateTime} currentTime - Current time in the campaign owner's timezone.
 * @param {string} deliveryPeriod - Delivery period of the campaign being sized.
 * @param {Map<string, number>} sentToday - Sends already made per credential id.
 * @returns {number} Sends available, 0 when the mailbox is done.
 */
export function credentialSendBudget(
  credential: any,
  currentTime: DateTime,
  deliveryPeriod: string,
  sentToday: Map<string, number>,
): number {
  const windowSeconds = Math.min(
    secondsLeftInWindow(currentTime, deliveryPeriod),
    QUEUE_HORIZON_SECONDS,
  );

  const sendsInWindow = Math.floor(windowSeconds / SEND_SPACING_SECONDS);

  // dailyLimit is NOT NULL with a default in the schema, so the scheduler and
  // the sender are sizing against the same number rather than each picking a
  // fallback of its own.
  const allowanceLeft = Math.max(
    0,
    credential.dailyLimit - (sentToday.get(credential.id) ?? 0),
  );

  return Math.min(sendsInWindow, allowanceLeft);
}
