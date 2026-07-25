import { Hono } from "hono";
import campaignQueue from "../queues/campaign.queue.js";

const queueRoutes = new Hono();

export { queueRoutes };
