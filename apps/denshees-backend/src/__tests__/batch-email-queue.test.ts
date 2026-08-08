import { describe, it, expect, vi, beforeEach } from "vitest";

// ----- Mocks -----

const { addBulk } = vi.hoisted(() => ({ addBulk: vi.fn() }));

vi.mock("bullmq", () => ({
  Queue: class {
    addBulk = addBulk;
  },
}));

vi.mock("../config/redis.js", () => ({ redis: {} }));

vi.mock("../utils/logger.js", () => ({ log: vi.fn() }));

import { enqueueEmails } from "../queues/batch-email.queue.js";

// ----- Tests -----

describe("enqueueEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addBulk.mockImplementation((jobs: any[]) =>
      Promise.resolve(jobs.map((job) => ({ id: job.opts.jobId }))),
    );
  });

  it("adds one job per email, keyed by the email id", async () => {
    await enqueueEmails(["e-1", "e-2", "e-3"]);

    expect(addBulk).toHaveBeenCalledTimes(1);

    const jobs = addBulk.mock.calls[0][0];
    expect(jobs).toHaveLength(3);
    expect(jobs.map((job: any) => job.opts.jobId)).toEqual([
      "e-1",
      "e-2",
      "e-3",
    ]);
    expect(jobs.map((job: any) => job.data)).toEqual([
      { emailIds: ["e-1"] },
      { emailIds: ["e-2"] },
      { emailIds: ["e-3"] },
    ]);
  });

  it("returns the enqueued job ids", async () => {
    const jobIds = await enqueueEmails(["e-1", "e-2"]);

    expect(jobIds).toEqual(["e-1", "e-2"]);
  });

  it("does not touch the queue when there is nothing to enqueue", async () => {
    const jobIds = await enqueueEmails([]);

    expect(addBulk).not.toHaveBeenCalled();
    expect(jobIds).toEqual([]);
  });

  it("keeps retry options and drops completed jobs so a later stage can requeue", async () => {
    await enqueueEmails(["e-1"]);

    const { opts } = addBulk.mock.calls[0][0][0];
    expect(opts.attempts).toBe(3);
    expect(opts.backoff).toEqual({ type: "exponential", delay: 60000 });
    expect(opts.removeOnComplete).toBe(true);
  });

  it("expires failed jobs so a failed email is not locked out of the queue forever", async () => {
    await enqueueEmails(["e-1"]);

    const { opts } = addBulk.mock.calls[0][0][0];
    // A live job record of any state blocks a re-add of the same jobId. Failed
    // records have to age out or the lead is never retried by a later tick.
    expect(opts.removeOnFail).toEqual({ age: 3600, count: 1000 });
  });
});
