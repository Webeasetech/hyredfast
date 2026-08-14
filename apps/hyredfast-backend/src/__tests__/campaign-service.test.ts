import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing the module under test
vi.mock("../services/prisma.service.js", () => ({
  prisma: {
    campaignEmail: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    pitchEmail: {
      findFirst: vi.fn(),
    },
    campaignMessage: {
      create: vi.fn(),
    },
    user: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../utils/logger.js", () => ({
  log: vi.fn(),
}));

import { prisma } from "../services/prisma.service.js";
import {
  fetchCampaignEmails,
  fetchPitch,
  updateEmailStatus,
  createCampaignMessage,
} from "../services/campaign-service.js";
import type { EmailRecord, PitchRecord } from "../models/email.js";

// ----- Fixtures -----

function makeEmail(overrides: Partial<EmailRecord> = {}): EmailRecord {
  return {
    id: "email-1",
    email: "test@example.com",
    name: "Test User",
    stage: 0,
    status: "PENDING",
    personalization: {},
    campaign: {
      id: "campaign-1",
      maxStageCount: 3,
      user: { id: "user-1", email: "owner@example.com", credits: 10 },
    },
    ...overrides,
  };
}

function makePitch(overrides: Partial<PitchRecord> = {}): PitchRecord {
  return {
    id: "pitch-1",
    subject: "Hello {{name}}",
    message: "<p>Hi {{name}}</p>",
    ...overrides,
  };
}

// ----- Tests -----

describe("fetchCampaignEmails", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns campaign emails from prisma", async () => {
    const fakeEmails = [makeEmail()];
    vi.mocked(prisma.campaignEmail.findMany).mockResolvedValue(
      fakeEmails as any,
    );

    const result = await fetchCampaignEmails(["email-1"]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("email-1");
    expect(prisma.campaignEmail.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["email-1"] } },
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
    });
  });

  it("chunks large ID lists and flattens results", async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `email-${i}`);
    vi.mocked(prisma.campaignEmail.findMany).mockResolvedValue([
      makeEmail(),
    ] as any);

    const result = await fetchCampaignEmails(ids, 50);

    // 120 ids → 3 chunks (50 + 50 + 20)
    expect(prisma.campaignEmail.findMany).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3); // 1 email per chunk mock
  });

  it("rethrows prisma errors", async () => {
    vi.mocked(prisma.campaignEmail.findMany).mockRejectedValue(
      new Error("DB connection failed"),
    );

    await expect(fetchCampaignEmails(["email-1"])).rejects.toThrow(
      "DB connection failed",
    );
  });
});

describe("fetchPitch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes campaign ID string (not object) to prisma query", async () => {
    const email = makeEmail();

    vi.mocked(prisma.pitchEmail.findFirst).mockResolvedValue(null);

    await fetchPitch(email);

    const callArgs = vi.mocked(prisma.pitchEmail.findFirst).mock.calls[0][0];
    expect(callArgs?.where?.campaignId).toBe("campaign-1");
    expect(typeof callArgs?.where?.campaignId).toBe("string");
  });

  it("returns pitch when found (simulating fixed query)", async () => {
    const fakePitch = makePitch();
    vi.mocked(prisma.pitchEmail.findFirst).mockResolvedValue(fakePitch as any);

    const email = makeEmail();
    const result = await fetchPitch(email);

    expect(result).toEqual(fakePitch);
  });

  it("returns null and does not throw on prisma error", async () => {
    vi.mocked(prisma.pitchEmail.findFirst).mockRejectedValue(
      new Error("query failed"),
    );

    const result = await fetchPitch(makeEmail());
    expect(result).toBeNull();
  });
});

describe("updateEmailStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Identifiable stand-ins so the transaction's contents can be asserted.
    vi.mocked(prisma.campaignEmail.update).mockReturnValue("row-write" as any);
    vi.mocked(prisma.user.updateMany).mockReturnValue("credit-write" as any);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as any);
  });

  it("decrements user credits and advances stage", async () => {
    const email = makeEmail({ stage: 0 });

    await updateEmailStatus(email);

    expect(prisma.campaignEmail.update).toHaveBeenCalledWith({
      where: { id: "email-1" },
      data: {
        status: "RUNNING",
        stage: 1,
        sentAt: expect.any(Date),
      },
    });
  });

  it("writes the row and the credit in one transaction", async () => {
    // Charging without recording the send leaves the lead eligible again on
    // the next tick, so it goes out twice.
    await updateEmailStatus(makeEmail({ stage: 0 }));

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.$transaction).mock.calls[0][0]).toEqual([
      "row-write",
      "credit-write",
    ]);
  });

  it("guards the decrement so credits cannot go negative", async () => {
    await updateEmailStatus(makeEmail({ stage: 0 }));

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", credits: { gt: 0 } },
      data: { credits: { decrement: 1 } },
    });
  });

  it("sets COMPLETED status when at final stage", async () => {
    // maxStageCount=3, so final sending stage is 2 (0-indexed)
    const email = makeEmail({ stage: 2 });

    await updateEmailStatus(email);

    expect(prisma.campaignEmail.update).toHaveBeenCalledWith({
      where: { id: "email-1" },
      data: {
        status: "COMPLETED",
        stage: 3,
        sentAt: expect.any(Date),
      },
    });
  });

  it("sets COMPLETED when a lead is past the cap (e.g. follow-up count reduced)", async () => {
    // Lead is at stage 3 but the campaign was shrunk to maxStageCount=3
    // (last stage index 2). The >= check must complete it, not loop it.
    const email = makeEmail({ stage: 3, campaign: { id: "c-1", maxStageCount: 3 } });

    await updateEmailStatus(email);

    expect(prisma.campaignEmail.update).toHaveBeenCalledWith({
      where: { id: "email-1" },
      data: {
        status: "COMPLETED",
        stage: 4,
        sentAt: expect.any(Date),
      },
    });
  });

  it("skips credit decrement when no user on campaign", async () => {
    const email = makeEmail({ campaign: { id: "c-1", maxStageCount: 1 } });

    await updateEmailStatus(email);

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(vi.mocked(prisma.$transaction).mock.calls[0][0]).toEqual([
      "row-write",
    ]);
  });

  it("rethrows errors from the transaction", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("db error"));

    await expect(updateEmailStatus(makeEmail())).rejects.toThrow("db error");
  });
});

describe("createCampaignMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a campaign message record", async () => {
    vi.mocked(prisma.campaignMessage.create).mockResolvedValue({} as any);

    const email = makeEmail();
    const pitch = makePitch();

    await createCampaignMessage(
      email,
      pitch,
      "<msg-id@mail>",
      "<p>body</p>",
      "tx1",
    );

    expect(prisma.campaignMessage.create).toHaveBeenCalledWith({
      data: {
        sent: true,
        text: "<p>body</p>",
        pitchId: "pitch-1",
        messageId: "<msg-id@mail>",
        campaignEmailId: "email-1",
      },
    });
  });

  it("rethrows prisma create errors", async () => {
    vi.mocked(prisma.campaignMessage.create).mockRejectedValue(
      new Error("unique constraint"),
    );

    await expect(
      createCampaignMessage(makeEmail(), makePitch(), "id", "body", "tx"),
    ).rejects.toThrow("unique constraint");
  });
});
