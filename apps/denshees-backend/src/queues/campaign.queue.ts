import { Queue, redisConnection } from "../config/redis.js";

const campaignQueue = new Queue("campaignQueue", {
  connection: redisConnection,
});

await campaignQueue.upsertJobScheduler(
  "email-scheduler",
  // Every 15 minutes. The pattern is evaluated in the server's timezone (UTC),
  // while delivery windows are evaluated in each user's, so an hourly tick
  // lands at :30 past the local hour for a UTC+5:30 user and eats the first
  // half hour of their window. Quarter hourly ticks line up with every IANA
  // offset, which are all whole multiples of 15 minutes.
  { pattern: "*/15 * * * *" },
  {
    name: "campaign-queue",
    opts: {
      backoff: 3,
      attempts: 5,
      removeOnFail: 1000,
    },
  }
);

export default campaignQueue;
