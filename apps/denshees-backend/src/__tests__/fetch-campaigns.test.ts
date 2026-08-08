import { describe, it, expect, vi, beforeEach } from "vitest";

// ----- Mocks -----

vi.mock("../services/prisma.service.js", () => ({
  prisma: {
    campaign: { findMany: vi.fn() },
    campaignEmail: { findMany: vi.fn() },
  },
}));

vi.mock("../queues/batch-email.queue.js", () => ({
  enqueueEmails: vi.fn().mockResolvedValue(["job-1"]),
}));

import { prisma } from "../services/prisma.service.js";
import { enqueueEmails } from "../queues/batch-email.queue.js";
import { processCampaignJob } from "../jobs/fetch-campaigns.js";

// ----- Helpers -----

/** Creates a campaign fixture with the user in a given timezone. */
function makeCampaign(overrides: Record<string, any> = {}) {
  return {
    id: "campaign-1",
    deleted: false,
    status: "RUNNING",
    userId: "user-1",
    emailDeliveryPeriod: "MORNING",
    activeDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    daysInterval: 1,
    maxStageCount: 3,
    user: {
      id: "user-1",
      email: "owner@test.com",
      timezone: "America/New_York",
      credits: 10,
    },
    ...overrides,
  };
}

function makeCampaignEmail(overrides: Record<string, any> = {}) {
  return {
    id: "ce-1",
    email: "lead@example.com",
    name: "Lead",
    stage: 0,
    status: "PENDING",
    sentAt: null,
    campaignId: "campaign-1",
    campaign: { daysInterval: 1 },
    ...overrides,
  };
}

// ----- Tests -----

describe("processCampaignJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty when no campaigns exist", async () => {
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);

    const result = await processCampaignJob();

    expect(result).toEqual([]);
    expect(enqueueEmails).not.toHaveBeenCalled();
  });

  it("filters out campaigns with no user timezone", async () => {
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      makeCampaign({ user: { id: "u-1", timezone: null, credits: 10 } }),
    ] as any);

    const result = await processCampaignJob();

    expect(result).toEqual([]);
  });

  it("filters out the campaigns whose timezone is not a real IANA zone", async () => {
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      makeCampaign({
        user: { id: "u-1", timezone: "Not/AZone", credits: 10 },
      }),
    ] as any);

    const result = await processCampaignJob();

    expect(result).toEqual([]);
    expect(enqueueEmails).not.toHaveBeenCalled();
  });

  it("filters out campaigns with no emailDeliveryPeriod", async () => {
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      makeCampaign({ emailDeliveryPeriod: null }),
    ] as any);

    const result = await processCampaignJob();

    expect(result).toEqual([]);
  });

  it("filters out campaigns where user has 0 credits", async () => {
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      makeCampaign({
        user: {
          id: "u-1",
          timezone: "UTC",
          credits: 0,
        },
      }),
    ] as any);

    const result = await processCampaignJob();

    expect(result).toEqual([]);
  });

  it("filters out campaigns outside delivery period", async () => {
    // Force current hour to be 22 (NIGHT period = 18-24) but campaign expects MORNING (6-12)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T22:00:00Z")); // 22:00 UTC

    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      makeCampaign({
        emailDeliveryPeriod: "MORNING",
        user: { id: "u-1", timezone: "UTC", credits: 10, email: "o@t.com" },
      }),
    ] as any);

    const result = await processCampaignJob();

    expect(result).toEqual([]);
    vi.useRealTimers();
  });

  it("includes campaigns within delivery period", async () => {
    vi.useFakeTimers();
    // 9 AM UTC on a Wednesday
    vi.setSystemTime(new Date("2026-03-25T09:00:00Z"));

    const campaign = makeCampaign({
      emailDeliveryPeriod: "MORNING",
      activeDays: ["wednesday"],
      user: { id: "u-1", timezone: "UTC", credits: 10, email: "o@t.com" },
    });

    vi.mocked(prisma.campaign.findMany).mockResolvedValue([campaign] as any);
    vi.mocked(prisma.campaignEmail.findMany).mockResolvedValue([
      makeCampaignEmail({ campaignId: campaign.id }),
    ] as any);

    const result = await processCampaignJob();

    expect(enqueueEmails).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("filters out campaigns on inactive days", async () => {
    vi.useFakeTimers();
    // Sunday 9 AM UTC
    vi.setSystemTime(new Date("2026-03-22T09:00:00Z"));

    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      makeCampaign({
        emailDeliveryPeriod: "MORNING",
        // Only active on weekdays
        activeDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        user: { id: "u-1", timezone: "UTC", credits: 10, email: "o@t.com" },
      }),
    ] as any);

    const result = await processCampaignJob();

    expect(result).toEqual([]);
    vi.useRealTimers();
  });

  it("offers an eligible email on every tick and leaves dedup to the queue", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T09:00:00Z")); // Wednesday 9am UTC

    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      makeCampaign({
        emailDeliveryPeriod: "MORNING",
        activeDays: ["wednesday"],
        user: { id: "u-1", timezone: "UTC", credits: 10, email: "o@t.com" },
      }),
    ] as any);

    vi.mocked(prisma.campaignEmail.findMany).mockResolvedValue([
      makeCampaignEmail({ id: "ce-still-queued" }),
    ] as any);

    // The scheduler keeps no memory of what it queued. A row still in flight is
    // offered again and the queue rejects it on the jobId, which is what makes
    // this survive a restart.
    await processCampaignJob();
    await processCampaignJob();

    expect(enqueueEmails).toHaveBeenCalledTimes(2);
    expect(enqueueEmails).toHaveBeenNthCalledWith(1, ["ce-still-queued"]);
    expect(enqueueEmails).toHaveBeenNthCalledWith(2, ["ce-still-queued"]);
    vi.useRealTimers();
  });

  it("filters out emails sent too recently based on daysInterval", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T09:00:00Z")); // Wednesday 9am UTC

    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      makeCampaign({
        emailDeliveryPeriod: "MORNING",
        activeDays: ["wednesday"],
        user: { id: "u-1", timezone: "UTC", credits: 10, email: "o@t.com" },
      }),
    ] as any);

    // This email was sent yesterday and daysInterval=5, so it should NOT be sent yet.
    const yesterday = new Date("2026-03-24T09:00:00Z");
    vi.mocked(prisma.campaignEmail.findMany).mockResolvedValue([
      makeCampaignEmail({
        id: "ce-too-soon",
        stage: 1,
        sentAt: yesterday,
        campaign: { daysInterval: 5 },
      }),
    ] as any);

    const result = await processCampaignJob();

    // Fixed: email is correctly filtered out (only 1 day passed, need 5)
    expect(enqueueEmails).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("enqueues emails when enough days have passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T09:00:00Z")); // Wednesday 9am UTC

    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      makeCampaign({
        emailDeliveryPeriod: "MORNING",
        activeDays: ["wednesday"],
        user: { id: "u-1", timezone: "UTC", credits: 10, email: "o@t.com" },
      }),
    ] as any);

    // Sent 6 days ago with daysInterval=5 → should be sent
    const sixDaysAgo = new Date("2026-03-19T09:00:00Z");
    vi.mocked(prisma.campaignEmail.findMany).mockResolvedValue([
      makeCampaignEmail({
        id: "ce-ready",
        stage: 1,
        sentAt: sixDaysAgo,
        campaign: { daysInterval: 5 },
      }),
    ] as any);

    const result = await processCampaignJob();

    expect(enqueueEmails).toHaveBeenCalledWith(["ce-ready"]);

    vi.useRealTimers();
  });

  it("uses the per-stage pitch delay over the campaign-wide daysInterval", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T09:00:00Z")); // Wednesday 9am UTC

    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      makeCampaign({
        emailDeliveryPeriod: "MORNING",
        activeDays: ["wednesday"],
        user: { id: "u-1", timezone: "UTC", credits: 10, email: "o@t.com" },
      }),
    ] as any);

    // Global daysInterval=1 would allow a send after 1 day, but the stage-1
    // pitch's delayDays=5 must win → NOT sent yet (only 1 day passed).
    const yesterday = new Date("2026-03-24T09:00:00Z");
    vi.mocked(prisma.campaignEmail.findMany).mockResolvedValue([
      makeCampaignEmail({
        id: "ce-perstage",
        stage: 1,
        sentAt: yesterday,
        campaign: {
          daysInterval: 1,
          pitches: [{ stage: 1, delayDays: 5 }],
        },
      }),
    ] as any);

    const result = await processCampaignJob();

    expect(enqueueEmails).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("fires a follow-up once the delay's calendar date arrives, whatever hour the parent went out", async () => {
    vi.useFakeTimers();
    // Now: Mar 25 01:00 UTC (MIDNIGHT window, hour 1).
    vi.setSystemTime(new Date("2026-03-25T01:00:00Z"));

    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      makeCampaign({
        emailDeliveryPeriod: "MIDNIGHT",
        activeDays: [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ],
        user: { id: "u-1", timezone: "UTC", credits: 10, email: "o@t.com" },
      }),
    ] as any);

    // Sent Mar 23 23:00, delay 2 → due on Mar 25, any hour inside the window.
    // Only ~26h have elapsed, so elapsed-hours counting would hold this back
    // until Mar 25 23:00, past the window, losing the whole day.
    vi.mocked(prisma.campaignEmail.findMany).mockResolvedValue([
      makeCampaignEmail({
        id: "ce-due",
        stage: 1,
        sentAt: new Date("2026-03-23T23:00:00Z"),
        campaign: { daysInterval: 2 },
      }),
    ] as any);

    await processCampaignJob();

    expect(enqueueEmails).toHaveBeenCalledWith(["ce-due"]);

    vi.useRealTimers();
  });

  it("does not fire a follow-up before its calendar date", async () => {
    vi.useFakeTimers();
    // Now: Mar 25 01:00 UTC (MIDNIGHT window, hour 1).
    vi.setSystemTime(new Date("2026-03-25T01:00:00Z"));

    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      makeCampaign({
        emailDeliveryPeriod: "MIDNIGHT",
        activeDays: [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ],
        user: { id: "u-1", timezone: "UTC", credits: 10, email: "o@t.com" },
      }),
    ] as any);

    // Sent Mar 24, delay 2 → not due until Mar 26.
    vi.mocked(prisma.campaignEmail.findMany).mockResolvedValue([
      makeCampaignEmail({
        id: "ce-not-due",
        stage: 1,
        sentAt: new Date("2026-03-24T01:00:00Z"),
        campaign: { daysInterval: 2 },
      }),
    ] as any);

    await processCampaignJob();

    expect(enqueueEmails).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  // Measured in production: every follow-up whose parent went out at 9 AM or
  // 11 AM in a MORNING window slipped a day, because the next tick at or after
  // the parent's own send hour fell outside the 6-12 window.
  for (const parentHour of [9, 11]) {
    it(`sends the follow-up the next morning when the parent went out at ${parentHour} AM`, async () => {
      vi.useFakeTimers();
      // Next day, 06:00 UTC, first tick of the MORNING window.
      vi.setSystemTime(new Date("2026-03-25T06:00:00Z")); // Wednesday

      vi.mocked(prisma.campaign.findMany).mockResolvedValue([
        makeCampaign({
          emailDeliveryPeriod: "MORNING",
          activeDays: ["wednesday"],
          user: { id: "u-1", timezone: "UTC", credits: 10, email: "o@t.com" },
        }),
      ] as any);

      const parentSentAt = new Date(
        `2026-03-24T${String(parentHour).padStart(2, "0")}:00:00Z`,
      );
      vi.mocked(prisma.campaignEmail.findMany).mockResolvedValue([
        makeCampaignEmail({
          id: "ce-followup",
          stage: 1,
          sentAt: parentSentAt,
          campaign: { daysInterval: 1 },
        }),
      ] as any);

      await processCampaignJob();

      expect(enqueueEmails).toHaveBeenCalledWith(["ce-followup"]);

      vi.useRealTimers();
    });
  }

  it("measures the delay in the user's timezone, not UTC", async () => {
    vi.useFakeTimers();
    // Mar 25 04:00 UTC = Mar 25 09:30 IST, inside MORNING.
    vi.setSystemTime(new Date("2026-03-25T04:00:00Z")); // Wednesday

    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      makeCampaign({
        emailDeliveryPeriod: "MORNING",
        activeDays: ["wednesday"],
        user: {
          id: "u-1",
          timezone: "Asia/Kolkata",
          credits: 10,
          email: "o@t.com",
        },
      }),
    ] as any);

    // Sent Mar 24 20:00 UTC, which is Mar 25 01:30 for the user. In UTC days
    // that reads as yesterday and delay 1 would be satisfied; in the user's own
    // timezone it is still the same day, so the follow-up waits.
    vi.mocked(prisma.campaignEmail.findMany).mockResolvedValue([
      makeCampaignEmail({
        id: "ce-same-day-ist",
        stage: 1,
        sentAt: new Date("2026-03-24T20:00:00Z"),
        campaign: { daysInterval: 1 },
      }),
    ] as any);

    await processCampaignJob();

    expect(enqueueEmails).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("handles errors gracefully and returns empty array", async () => {
    vi.mocked(prisma.campaign.findMany).mockRejectedValue(
      new Error("DB connection lost"),
    );

    const result = await processCampaignJob();

    expect(result).toEqual([]);
  });
});

describe("delivery period boundaries", () => {
  beforeEach(() => vi.clearAllMocks());

  const periods = [
    { name: "MORNING", validHour: 9, invalidHour: 13 },
    { name: "EVENING", validHour: 15, invalidHour: 19 },
    { name: "NIGHT", validHour: 21, invalidHour: 5 },
    { name: "MIDNIGHT", validHour: 3, invalidHour: 7 },
  ];

  for (const { name, validHour, invalidHour } of periods) {
    it(`${name}: enqueues during valid hour (${validHour}:00)`, async () => {
      vi.useFakeTimers();
      // Use a Wednesday
      const date = new Date(
        `2026-03-25T${String(validHour).padStart(2, "0")}:00:00Z`,
      );
      vi.setSystemTime(date);

      vi.mocked(prisma.campaign.findMany).mockResolvedValue([
        makeCampaign({
          emailDeliveryPeriod: name,
          activeDays: ["wednesday"],
          user: { id: "u-1", timezone: "UTC", credits: 10, email: "o@t.com" },
        }),
      ] as any);

      vi.mocked(prisma.campaignEmail.findMany).mockResolvedValue([
        makeCampaignEmail(),
      ] as any);

      await processCampaignJob();

      expect(enqueueEmails).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it(`${name}: does NOT enqueue during invalid hour (${invalidHour}:00)`, async () => {
      vi.useFakeTimers();
      const date = new Date(
        `2026-03-25T${String(invalidHour).padStart(2, "0")}:00:00Z`,
      );
      vi.setSystemTime(date);

      vi.mocked(prisma.campaign.findMany).mockResolvedValue([
        makeCampaign({
          emailDeliveryPeriod: name,
          activeDays: ["wednesday"],
          user: { id: "u-1", timezone: "UTC", credits: 10, email: "o@t.com" },
        }),
      ] as any);

      await processCampaignJob();

      expect(enqueueEmails).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  }
});

describe("timezone handling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("respects user timezone for delivery period check", async () => {
    vi.useFakeTimers();
    // 14:00 UTC = 9:00 AM EST (America/New_York is UTC-5 in March)
    vi.setSystemTime(new Date("2026-03-25T14:00:00Z")); // Wednesday

    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      makeCampaign({
        emailDeliveryPeriod: "MORNING", // 6-12 in user's timezone
        activeDays: ["wednesday"],
        user: {
          id: "u-1",
          timezone: "America/New_York",
          credits: 10,
          email: "o@t.com",
        },
      }),
    ] as any);

    vi.mocked(prisma.campaignEmail.findMany).mockResolvedValue([
      makeCampaignEmail(),
    ] as any);

    await processCampaignJob();

    // 9 AM EST is within MORNING (6-12), so emails should be enqueued
    expect(enqueueEmails).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("rejects when UTC time is morning but user timezone is not", async () => {
    vi.useFakeTimers();
    // 9:00 UTC = 4:00 AM EST → MIDNIGHT period, not MORNING
    vi.setSystemTime(new Date("2026-03-25T09:00:00Z")); // Wednesday

    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      makeCampaign({
        emailDeliveryPeriod: "MORNING",
        activeDays: ["wednesday"],
        user: {
          id: "u-1",
          timezone: "America/New_York",
          credits: 10,
          email: "o@t.com",
        },
      }),
    ] as any);

    await processCampaignJob();

    // 4 AM EST is NOT within MORNING (6-12)
    expect(enqueueEmails).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
