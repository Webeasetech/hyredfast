import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";

import {
  credentialSendBudget,
  secondsLeftInWindow,
} from "../utils/send-capacity.js";

// ----- Helpers -----

function at(iso: string) {
  return DateTime.fromISO(iso, { zone: "UTC" });
}

// ----- Tests -----

describe("secondsLeftInWindow", () => {
  it("counts down to the close of the period", () => {
    expect(secondsLeftInWindow(at("2026-03-25T09:00:00"), "MORNING")).toBe(
      3 * 3600,
    );
  });

  it("treats a NIGHT window as closing at midnight", () => {
    expect(secondsLeftInWindow(at("2026-03-25T23:00:00"), "NIGHT")).toBe(3600);
  });

  it("returns 0 once the window has passed", () => {
    expect(secondsLeftInWindow(at("2026-03-25T15:00:00"), "MORNING")).toBe(0);
  });

  it("returns 0 for a period it does not recognise", () => {
    expect(secondsLeftInWindow(at("2026-03-25T09:00:00"), "LUNCHTIME")).toBe(0);
  });
});

describe("credentialSendBudget", () => {
  const sentNothing = new Map<string, number>();
  const roomy = { id: "cred-1", dailyLimit: 500 };

  it("gives two ticks worth while the window is wide open", () => {
    // 1800s of horizon at one send per 25s.
    expect(
      credentialSendBudget(
        roomy,
        at("2026-03-25T06:00:00"),
        "MORNING",
        sentNothing,
      ),
    ).toBe(72);
  });

  it("shrinks to what fits when the window is nearly closed", () => {
    // 100 seconds left is four sends at 25s spacing.
    expect(
      credentialSendBudget(
        roomy,
        at("2026-03-25T11:58:20"),
        "MORNING",
        sentNothing,
      ),
    ).toBe(4);
  });

  it("stops at the mailbox's remaining daily allowance", () => {
    const sentToday = new Map([["cred-1", 15]]);

    expect(
      credentialSendBudget(
        { id: "cred-1", dailyLimit: 20 },
        at("2026-03-25T06:00:00"),
        "MORNING",
        sentToday,
      ),
    ).toBe(5);
  });

  it("gives nothing to a mailbox that is done for the day", () => {
    const sentToday = new Map([["cred-1", 20]]);

    expect(
      credentialSendBudget(
        { id: "cred-1", dailyLimit: 20 },
        at("2026-03-25T06:00:00"),
        "MORNING",
        sentToday,
      ),
    ).toBe(0);
  });

  it("falls back to the sender's default daily limit", () => {
    expect(
      credentialSendBudget(
        { id: "cred-1", dailyLimit: null },
        at("2026-03-25T06:00:00"),
        "MORNING",
        sentNothing,
      ),
    ).toBe(20);
  });

  it("gives nothing once the window has closed", () => {
    expect(
      credentialSendBudget(
        roomy,
        at("2026-03-25T15:00:00"),
        "MORNING",
        sentNothing,
      ),
    ).toBe(0);
  });
});
