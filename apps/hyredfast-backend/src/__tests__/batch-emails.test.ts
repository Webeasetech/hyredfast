import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ----- Mocks -----

vi.mock("../utils/logger.js", () => ({ log: vi.fn() }));

vi.mock("../utils/helpers.js", () => ({
  delay: vi.fn().mockResolvedValue(undefined), // no-op delay for fast tests
}));

vi.mock("../utils/credential-service.js", () => ({
  extractUniqueCredentials: vi.fn(() => []),
  setupEmailTransporters: vi.fn(),
}));

vi.mock("../services/campaign-service.js", () => ({
  fetchCampaignEmails: vi.fn(),
}));

vi.mock("../services/email-service.js", () => ({
  sendCampaignEmail: vi.fn(),
}));

vi.mock("../config/redis.js", () => ({ redis: {} }));

import { fetchCampaignEmails } from "../services/campaign-service.js";
import { sendCampaignEmail } from "../services/email-service.js";
import {
  extractUniqueCredentials,
  setupEmailTransporters,
} from "../utils/credential-service.js";
import { processEmailBatchJob } from "../jobs/batch-emails.js";
import { CredentialBusyError } from "../utils/send-lock.js";
import { delay } from "../utils/helpers.js";
import type { EmailRecord } from "../models/email.js";

// ----- Helpers -----

function makeEmail(overrides: Partial<any> = {}): EmailRecord {
  return {
    id: "email-1",
    email: "test@example.com",
    name: "Test",
    stage: 0,
    status: "PENDING",
    personalization: {},
    campaign: {
      id: "campaign-1",
      maxStageCount: 3,
      emailDeliveryPeriod: "MORNING",
      activeDays: ["wednesday"],
      user: { id: "user-1", email: "o@t.com", credits: 10, timezone: "UTC" },
      campaignEmailCredentials: [
        {
          emailCredential: {
            id: "cred-1",
            host: "smtp.example.com",
            port: 587,
            secure: false,
            username: "sender@example.com",
            password: "secret",
            dailyLimit: 50,
          },
        },
      ],
    },
    ...overrides,
  } as any;
}

// ----- Tests -----

describe("processEmailBatchJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Inside the fixture's MORNING window, Wednesday 9 AM UTC. The batch job
    // re-checks the window per email, so the clock has to be pinned.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T09:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("returns empty array when no email IDs provided", async () => {
    const result = await processEmailBatchJob([]);
    expect(result).toEqual([]);
    expect(fetchCampaignEmails).not.toHaveBeenCalled();
  });

  it("accepts object format with emailIds property", async () => {
    vi.mocked(fetchCampaignEmails).mockResolvedValue([]);

    const result = await processEmailBatchJob({ emailIds: [] });
    expect(result).toEqual([]);
  });

  it("fetches emails, sets up transporters, and processes", async () => {
    const emails = [makeEmail({ id: "e-1" }), makeEmail({ id: "e-2" })];
    vi.mocked(fetchCampaignEmails).mockResolvedValue(emails);
    vi.mocked(sendCampaignEmail).mockResolvedValue();

    const result = await processEmailBatchJob(["e-1", "e-2"]);

    expect(fetchCampaignEmails).toHaveBeenCalledWith(["e-1", "e-2"]);
    expect(extractUniqueCredentials).toHaveBeenCalledWith(emails);
    expect(setupEmailTransporters).toHaveBeenCalled();
    expect(sendCampaignEmail).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });

  it("returns an empty array when the fetch fails", async () => {
    vi.mocked(fetchCampaignEmails).mockRejectedValue(new Error("DB down"));

    const result = await processEmailBatchJob(["email-1"]);

    expect(result).toEqual([]);
  });

  it("lets a busy mailbox out so the worker can reschedule the job", async () => {
    vi.mocked(fetchCampaignEmails).mockResolvedValue([makeEmail()]);
    vi.mocked(sendCampaignEmail).mockRejectedValue(
      new CredentialBusyError("cred-1", 5000),
    );

    // Every other send error is swallowed here. This one has to escape, or the
    // job completes, its jobId frees, and the email waits for the next tick.
    await expect(processEmailBatchJob(["email-1"])).rejects.toBeInstanceOf(
      CredentialBusyError,
    );
  });

  it("does not bounce a job that has already sent something", async () => {
    const emails = [makeEmail({ id: "e-1" }), makeEmail({ id: "e-2" })];
    vi.mocked(fetchCampaignEmails).mockResolvedValue(emails);
    vi.mocked(sendCampaignEmail)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new CredentialBusyError("cred-1", 5000));

    // Rescheduling re-runs every email in the job, so e-1 would go out twice.
    const result = await processEmailBatchJob(["e-1", "e-2"]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e-1");
  });

  it("no longer paces sends itself, the credential lock does", async () => {
    const emails = [makeEmail({ id: "e-1" }), makeEmail({ id: "e-2" })];
    vi.mocked(fetchCampaignEmails).mockResolvedValue(emails);
    vi.mocked(sendCampaignEmail).mockResolvedValue();

    await processEmailBatchJob(["e-1", "e-2"]);

    expect(sendCampaignEmail).toHaveBeenCalledTimes(2);
    expect(delay).not.toHaveBeenCalled();
  });

  it("continues processing remaining emails when one fails", async () => {
    const emails = [makeEmail({ id: "e-1" }), makeEmail({ id: "e-2" })];
    vi.mocked(fetchCampaignEmails).mockResolvedValue(emails);
    vi.mocked(sendCampaignEmail)
      .mockRejectedValueOnce(new Error("send failed"))
      .mockResolvedValueOnce(undefined);

    const result = await processEmailBatchJob(["e-1", "e-2"]);

    expect(sendCampaignEmail).toHaveBeenCalledTimes(2);
    // First email threw, so only the second is in results
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e-2");
  });

  it("groups emails as 'unassigned' when credId is not set", async () => {
    const emails = [
      makeEmail({ id: "e-1", credId: undefined }),
      makeEmail({ id: "e-2", credId: undefined }),
    ];
    vi.mocked(fetchCampaignEmails).mockResolvedValue(emails);
    vi.mocked(sendCampaignEmail).mockResolvedValue();

    await processEmailBatchJob(["e-1", "e-2"]);

    // Both emails processed (all grouped together under "unassigned")
    expect(sendCampaignEmail).toHaveBeenCalledTimes(2);
  });

  it("groups emails by credential when credId IS present", async () => {
    const emails = [
      makeEmail({ id: "e-1", credId: "cred-A" }),
      makeEmail({ id: "e-2", credId: "cred-B" }),
      makeEmail({ id: "e-3", credId: "cred-A" }),
    ];
    vi.mocked(fetchCampaignEmails).mockResolvedValue(emails);
    vi.mocked(sendCampaignEmail).mockResolvedValue();

    await processEmailBatchJob(["e-1", "e-2", "e-3"]);

    expect(sendCampaignEmail).toHaveBeenCalledTimes(3);
  });

  it("defers every email when the window closed before the batch ran", async () => {
    // Queued inside MORNING, running at 3 PM. A batch of 50 takes about 18
    // minutes, so one started near noon lands here.
    vi.setSystemTime(new Date("2026-03-25T15:00:00Z"));

    const emails = [makeEmail({ id: "e-1" }), makeEmail({ id: "e-2" })];
    vi.mocked(fetchCampaignEmails).mockResolvedValue(emails);

    const result = await processEmailBatchJob(["e-1", "e-2"]);

    expect(sendCampaignEmail).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("defers on a day the campaign is not active", async () => {
    // Thursday, and the fixture is only active on Wednesday.
    vi.setSystemTime(new Date("2026-03-26T09:00:00Z"));

    vi.mocked(fetchCampaignEmails).mockResolvedValue([makeEmail()]);

    const result = await processEmailBatchJob(["email-1"]);

    expect(sendCampaignEmail).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("sends only the campaigns still inside their window", async () => {
    const openCampaign = makeEmail({ id: "e-open" });
    const closedCampaign = makeEmail({ id: "e-closed" });
    (closedCampaign as any).campaign.id = "campaign-2";
    (closedCampaign as any).campaign.emailDeliveryPeriod = "MIDNIGHT";

    vi.mocked(fetchCampaignEmails).mockResolvedValue([
      openCampaign,
      closedCampaign,
    ]);
    vi.mocked(sendCampaignEmail).mockResolvedValue();

    const result = await processEmailBatchJob(["e-open", "e-closed"]);

    expect(sendCampaignEmail).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e-open");
  });
});
