/**
 * Campaign service for email processing
 */

import { v4 as uuidv4 } from "uuid";
import { prisma } from "./prisma.service.js";
import { log } from "../utils/logger.js";
import type { EmailRecord, PitchRecord } from "../models/email.js";

/**
 * Fetches campaign emails in batches to prevent query string too large errors.
 * @param emailIds - List of email IDs.
 * @param chunkSize - Number of emails per request batch (default: 50).
 * @returns Flattened array of campaign email records.
 */
export async function fetchCampaignEmails(
  emailIds: string[],
  chunkSize = 50,
): Promise<EmailRecord[]> {
  const txId = uuidv4().substring(0, 8);
  log("INFO", `Fetching campaign emails in chunks`, txId, {
    totalEmails: emailIds.length,
    chunkSize,
  });

  const chunkedRequests = [];

  for (let i = 0; i < emailIds.length; i += chunkSize) {
    const chunk = emailIds.slice(i, i + chunkSize);

    log(
      "INFO",
      `Fetching chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(
        emailIds.length / chunkSize,
      )}`,
      txId,
      {
        chunkSize: chunk.length,
      },
    );

    chunkedRequests.push(
      prisma.campaignLead.findMany({
        where: { id: { in: chunk } },
        include: {
          campaign: {
            include: {
              user: true,
              campaignEmailCredentials: {
                include: { emailCredential: true },
              },
            },
          },
        },
      }),
    );
  }

  try {
    const results = await Promise.all(chunkedRequests);
    const flattened = results.flat();

    log(
      "INFO",
      `Successfully fetched ${flattened.length} campaign emails`,
      txId,
    );
    return flattened;
  } catch (error: any) {
    log("ERROR", `Error fetching campaign emails`, txId, {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Fetches the pitch for an email's campaign and stage.
 * @param email - Email object from campaign.
 * @returns Pitch object or null if not found.
 */
export async function fetchPitch(
  email: EmailRecord,
): Promise<PitchRecord | null> {
  const txId = uuidv4().substring(0, 8);

  log(
    "INFO",
    `Fetching pitch for campaign ${email.campaign?.id} stage ${email.stage}`,
    txId,
  );

  try {
    const result = await prisma.pitchTemplate.findFirst({
      where: {
        stage: email.stage,
        campaignId: email.campaign?.id,
      },
    });

    if (!result) {
      log(
        "WARN",
        `No pitch found for campaign ${email.campaign?.id} stage ${email.stage}`,
        txId,
      );
      return null;
    }

    log("INFO", `Found pitch ${result.id}`, txId);
    return result as unknown as PitchRecord;
  } catch (error: any) {
    log("ERROR", `Error fetching pitch`, txId, {
      error: error.message,
      stack: error.stack,
      campaignId: email.campaign?.id,
      stage: email.stage,
    });
    return null;
  }
}

/**
 * Updates the email status after sending.
 * @param email - Email object.
 */
export async function updateEmailStatus(email: EmailRecord): Promise<void> {
  const txId = uuidv4().substring(0, 8);

  try {
    const user = email.campaign?.user;

    const nextStage = email.stage + 1;
    const maxStage = email.campaign?.maxStageCount || 1;
    // >= (not ===) so a lead already at or past the last stage — e.g. after the
    // follow-up count was reduced — completes instead of looping into FAILED.
    const nextStatus = email.stage >= maxStage - 1 ? "COMPLETED" : "RUNNING";

    log("INFO", `Updating email status`, txId, {
      emailId: email.id,
      currentStage: email.stage,
      nextStage,
      nextStatus,
      maxStage,
      userId: user?.id,
    });

    const writes: any[] = [
      prisma.campaignLead.update({
        where: { id: email.id },
        data: {
          status: nextStatus,
          stage: nextStage,
          sentAt: new Date(),
        },
      }),
    ];

    if (user && user.id) {
      // updateMany with a balance guard rather than update, so the decrement
      // is an atomic compare and set that cannot take credits below zero.
      // Matching no rows is fine and deliberate: the mail is already out, and
      // failing here would leave the lead eligible to be sent a second time.
      writes.push(
        prisma.user.updateMany({
          where: { id: user.id, credits: { gt: 0 } },
          data: { credits: { decrement: 1 } },
        }),
      );
    }

    // Both writes or neither. A charge that lands without the row update
    // leaves the lead eligible on the next tick, and it gets mailed twice.
    await prisma.$transaction(writes);

    log("INFO", `Email status updated successfully`, txId, {
      emailId: email.id,
      status: nextStatus,
      stage: nextStage,
    });
  } catch (error: any) {
    log("ERROR", `Error updating email status`, txId, {
      error: error.message,
      stack: error.stack,
      emailId: email.id,
    });
    throw error;
  }
}

/**
 * Creates a campaign message record after sending an email.
 * @param email - Email object.
 * @param pitch - Pitch object.
 * @param messageId - Message ID from the sent email.
 * @param body - Email body content.
 * @param txId - Transaction ID for logging.
 */
export async function createCampaignMessage(
  email: EmailRecord,
  pitch: PitchRecord,
  messageId: string,
  body: string,
  txId: string,
): Promise<void> {
  log("INFO", `Creating campaign message record`, txId);

  try {
    await prisma.campaignMessage.create({
      data: {
        sent: true,
        text: body,
        pitchId: pitch.id,
        messageId: messageId,
        campaignLeadId: email.id,
      },
    });

    log("INFO", `Campaign message record created successfully`, txId);
  } catch (error: any) {
    log("ERROR", `Error creating campaign message record`, txId, {
      error: error.message,
      stack: error.stack,
      emailId: email.id,
    });
    throw error;
  }
}
