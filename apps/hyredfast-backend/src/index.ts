import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { queueRoutes } from "./routes/queue.routes.js";
import imapQueue from "./queues/imap.queue.js";
import { campaignWorker } from "./workers/campaign.worker.js";
import { batchemailWorker } from "./workers/batchemail.worker.js";
import { imapWorker } from "./workers/imap.worker.js";
import { trackingRoutes } from "./routes/tracking.routes.js";
import { miscRoutes } from "./routes/misc.routes.js";
import { imapRoutes } from "./routes/imap.routes.js";

const app = new Hono();

app.route("/queue", queueRoutes);
app.route("/tracking", trackingRoutes);
app.route("/email", imapRoutes);
app.route("/", miscRoutes);

serve({ fetch: app.fetch, port: parseInt(process.env.PORT || "8100") });

console.log("Hono server running...");

// Docker sends SIGTERM on every deploy. Without this the workers are killed
// mid-send, and a job that already handed mail to SMTP is retried from the
// start, so the lead gets it twice. Closing lets active jobs finish first.
async function shutdown(signal: string) {
  console.log(`${signal} received, finishing active jobs before exit...`);

  await Promise.all([
    campaignWorker.close(),
    batchemailWorker.close(),
    imapWorker.close(),
  ]);

  console.log("Workers closed.");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
