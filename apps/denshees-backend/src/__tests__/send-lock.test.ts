import { describe, it, expect, vi, beforeEach } from "vitest";

// ----- Mocks -----

const { mockRedis } = vi.hoisted(() => ({
  mockRedis: { set: vi.fn(), pttl: vi.fn() },
}));

vi.mock("../config/redis.js", () => ({ redis: mockRedis }));

import {
  acquireCredentialLock,
  credentialRetryDelay,
  CredentialBusyError,
} from "../utils/send-lock.js";

// ----- Tests -----

describe("acquireCredentialLock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("claims the mailbox with an expiring NX key", async () => {
    mockRedis.set.mockResolvedValue("OK");

    const won = await acquireCredentialLock("cred-1");

    expect(won).toBe(true);
    expect(mockRedis.set).toHaveBeenCalledWith(
      "sendlock:cred:cred-1",
      "1",
      "EX",
      25,
      "NX",
    );
  });

  it("loses the race when the key is already held", async () => {
    mockRedis.set.mockResolvedValue(null);

    expect(await acquireCredentialLock("cred-1")).toBe(false);
  });
});

describe("credentialRetryDelay", () => {
  beforeEach(() => vi.clearAllMocks());

  it("waits for the mailbox that frees up first", async () => {
    mockRedis.pttl.mockImplementation(async (key: string) =>
      key.endsWith("cred-1") ? 20000 : 5000,
    );

    const delayMs = await credentialRetryDelay(["cred-1", "cred-2"]);

    // Earliest expiry is 5000, plus the 500 floor and up to 3000 of jitter.
    expect(delayMs).toBeGreaterThanOrEqual(5500);
    expect(delayMs).toBeLessThan(8500);
  });

  it("retries almost immediately when the lock has already expired", async () => {
    // ioredis returns -2 for a key that no longer exists.
    mockRedis.pttl.mockResolvedValue(-2);

    const delayMs = await credentialRetryDelay(["cred-1"]);

    expect(delayMs).toBeGreaterThanOrEqual(500);
    expect(delayMs).toBeLessThan(3500);
  });
});

describe("CredentialBusyError", () => {
  it("carries the wait so the worker can reschedule the job", () => {
    const error = new CredentialBusyError("cred-1", 4200);

    expect(error).toBeInstanceOf(Error);
    expect(error.retryAfterMs).toBe(4200);
    expect(error.message).toContain("cred-1");
  });
});
