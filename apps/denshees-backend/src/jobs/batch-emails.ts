/**
 * Email batch processing job
 */

import { v4 as uuidv4 } from "uuid";
import { log } from "../utils/logger.js";
import { delay } from "../utils/helpers.js";
import {
  extractUniqueCredentials,
  setupEmailTransporters,
} from "../utils/credential-service.js";
import { fetchCampaignEmails } from "../services/campaign-service.js";
import { sendCampaignEmail } from "../services/email-service.js";
import type { EmailRecord } from "../models/email.js";
import { isWithinDeliveryWindow } from "../utils/delivery-window.js";
import { removeEnqueuedEmailIds } from "../queues/batch-email.queue.js";

/**
 * Processes a batch job for sending campaign emails.
 * @param data - Array of email IDs or object with emailIds property.
 * @returns Array of processed emails
 */
export async function processEmailBatchJob(
  data: string[] | { emailIds: string[] },
): Promise<EmailRecord[]> {
  // Handle both array format and object format with emailIds property
  const emailIds = Array.isArray(data) ? data : data.emailIds;

  const batchId = uuidv4().substring(0, 8);
  const startTime = Date.now();

  log("INFO", `Starting email batch job`, batchId, {
    emailCount: emailIds?.length || 0,
    emailIds,
  });

  try {
    if (!emailIds || emailIds.length === 0) {
      log("WARN", `No email IDs provided`, batchId);
      return [];
    }

    log("INFO", `Fetching campaign emails`, batchId);
    const campaignEmails = await fetchCampaignEmails(emailIds);
    log("INFO", `Fetched ${campaignEmails.length} campaign emails`, batchId);

    // Extract and setup email transporters from the campaigns' emails arrays
    log("INFO", `Extracting unique credentials`, batchId);
    const uniqueCredentials = extractUniqueCredentials(campaignEmails);
    log(
      "INFO",
      `Found ${uniqueCredentials.length} unique credentials`,
      batchId,
    );

    setupEmailTransporters(uniqueCredentials);

    // Group emails by credential to avoid rate limiting
    const emailsByCredential = groupEmailsByCredential(campaignEmails);

    log("INFO", `Grouped emails by credential`, batchId, {
      credentialCount: emailsByCredential.size,
      distribution: Array.from(emailsByCredential.entries()).map(
        ([credId, emails]) => ({
          credId,
          emailCount: emails.length,
        }),
      ),
    });

    // Process emails by credential with appropriate delays
    const { results, deferred } = await processEmailsByCredential(
      emailsByCredential,
      batchId,
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    log("INFO", `Completed email batch job`, batchId, {
      duration: `${duration}ms`,
      totalEmails: campaignEmails.length,
      successCount: results.length,
      deferredCount: deferred.length,
      failureCount: campaignEmails.length - results.length - deferred.length,
      successRate:
        campaignEmails.length > 0
          ? `${Math.round((results.length / campaignEmails.length) * 100)}%`
          : "N/A",
    });

    removeEnqueuedEmailIds(emailIds);

    return results;
  } catch (error: any) {
    log("ERROR", `Error processing email batch job`, batchId, {
      error: error.message,
      stack: error.stack,
    });
    removeEnqueuedEmailIds(emailIds);

    return [];
  }
}

/**
 * Groups emails by credential ID to avoid rate limiting.
 * @param campaignEmails - List of campaign emails.
 * @returns Map of credential IDs to arrays of emails.
 */
function groupEmailsByCredential(
  campaignEmails: EmailRecord[],
): Map<string, EmailRecord[]> {
  const emailsByCredential = new Map<string, EmailRecord[]>();

  for (const email of campaignEmails) {
    const credId = email.credId || "unassigned";
    if (!emailsByCredential.has(credId)) {
      emailsByCredential.set(credId, []);
    }
    emailsByCredential.get(credId)?.push(email);
  }

  return emailsByCredential;
}

/**
 * Processes emails grouped by credential.
 * @param emailsByCredential - Map of credential IDs to arrays of emails.
 * @param batchId - Batch ID for logging.
 * @returns Successfully processed emails, and the ones deferred to a later window.
 */
async function processEmailsByCredential(
  emailsByCredential: Map<string, EmailRecord[]>,
  batchId: string,
): Promise<{ results: EmailRecord[]; deferred: EmailRecord[] }> {
  const results: EmailRecord[] = [];
  const deferred: EmailRecord[] = [];

  for (const [credId, emails] of emailsByCredential.entries()) {
    log("INFO", `Processing emails for credential ${credId}`, batchId, {
      emailCount: emails.length,
    });

    // Process emails for this credential with a longer delay
    for (const email of emails) {
      const emailTxId = `${batchId}:${email.id.substring(0, 6)}`;

      // The window is checked again here, not just at enqueue time. A batch of
      // 50 takes about 18 minutes, so one that starts near the end of a window
      // finishes outside it. Deferred emails keep their status and sentAt, so
      // the next scheduler tick inside the window picks them up untouched.
      if (!isWithinDeliveryWindow(email.campaign)) {
        log("INFO", `Deferring email, delivery window has closed`, emailTxId, {
          emailId: email.id,
          campaignId: email.campaign?.id,
        });
        deferred.push(email);
        continue;
      }

      try {
        log("INFO", `Processing email ${email.id}`, emailTxId);
        await sendCampaignEmail(email, emailTxId);
        results.push(email);

        // Use a longer delay between emails from the same credential (3-5 seconds)
        const delayMs = 20000 + Math.random() * 2000;
        log(
          "INFO",
          `Delaying ${Math.round(delayMs)}ms before next email`,
          emailTxId,
        );
        await delay(delayMs);
      } catch (error: any) {
        log("ERROR", `Error processing email ${email.id}`, emailTxId, {
          error: error.message,
          stack: error.stack,
        });
      }
    }

    // Add a longer delay between processing different credentials
    if (credId !== "unassigned" && emailsByCredential.size > 1) {
      const delayMs = 10000 + Math.random() * 5000;
      log(
        "INFO",
        `Delaying ${Math.round(delayMs)}ms before next credential`,
        batchId,
      );
      await delay(delayMs);
    }
  }

  return { results, deferred };
}
