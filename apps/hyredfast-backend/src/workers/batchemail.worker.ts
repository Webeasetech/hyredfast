import { DelayedError, Worker } from "bullmq"
import { redis } from "../config/redis.js"
import { processEmailBatchJob } from "../jobs/batch-emails.js"
import { CredentialBusyError } from "../utils/send-lock.js"

const batchemailWorker = new Worker(
  "batchEmailQueue",
  async (job, token) => {
    try {
      // Process the batch of emails
      const results = await processEmailBatchJob(job.data)

      console.log(`Job ${job.id} completed. Processed ${results.length} emails.`)
    } catch (error) {
      if (error instanceof CredentialBusyError) {
        // The job cannot re-add itself: its jobId is the email id and its own
        // record is still live. Moving it to delayed keeps that record, so the
        // scheduler still treats the email as in flight, and frees the slot for
        // a different mailbox instead of waiting here.
        console.log(
          `Job ${job.id} deferred ${error.retryAfterMs}ms, mailbox busy.`,
        )
        await job.moveToDelayed(Date.now() + error.retryAfterMs, token)
        throw new DelayedError()
      }

      throw error
    }
  },
  // Sends are I/O bound on SMTP and paced per credential by the send lock, so
  // slots are cheap. What they buy is different mailboxes sending at once.
  { connection: redis, concurrency: 25 },
)

// Add event handlers for better monitoring
batchemailWorker.on("completed", (job) => {
  console.log(`Job ${job.id} has completed successfully`)
})

batchemailWorker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} has failed with error: ${err.message}`)
})

export { batchemailWorker }
