import { Queue } from "bullmq"
import { redis } from "../config/redis.js"
import { log } from "../utils/logger.js"

// Create a queue for batch email processing
const batchEmailQueue = new Queue("batchEmailQueue", { connection: redis })

/**
 * Enqueues one job per email, keyed by the email's own id.
 *
 * BullMQ refuses to add a job whose jobId already has a record, so an email
 * that is queued, running or recently failed cannot be queued a second time.
 * That is the whole dedup mechanism: the scheduler is free to offer the same
 * row on every tick, and it survives a restart, which an in-process Set did not.
 *
 * @param emailIds - Array of email IDs to process
 * @returns Array of job IDs
 */
export async function enqueueEmails(emailIds: string[]): Promise<string[]> {
  if (emailIds.length === 0) return []

  const jobs = await batchEmailQueue.addBulk(
    emailIds.map((emailId) => ({
      name: "process-emails",
      data: { emailIds: [emailId] },
      opts: {
        jobId: emailId,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 60000, // 1 minute
        },
        // Completed jobs go immediately so the next stage of the same lead can
        // be queued on a later day. Failed ones age out instead of being kept
        // by count alone, because a surviving failed record would lock its
        // email out of the queue for good.
        removeOnComplete: true,
        removeOnFail: { age: 3600, count: 1000 },
      },
    })),
  )

  log("INFO", `Offered ${emailIds.length} emails to the queue`, "")

  return jobs.map((job) => job.id)
}
