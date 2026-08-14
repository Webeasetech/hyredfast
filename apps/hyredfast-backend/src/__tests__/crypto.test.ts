import { describe, it, expect, beforeAll } from "vitest";
import crypto from "node:crypto";
import {
  encryptSecret,
  decryptSecret,
  isEncrypted,
} from "../utils/crypto.js";

beforeAll(() => {
  process.env.CREDENTIAL_ENC_KEY = crypto.randomBytes(32).toString("base64");
});

describe("credential encryption", () => {
  it("round-trips a password", () => {
    const stored = encryptSecret("hunter2-app-password");

    expect(stored).not.toContain("hunter2");
    expect(decryptSecret(stored)).toBe("hunter2-app-password");
  });

  it("produces a different ciphertext each time", () => {
    // A fresh IV per call, so identical passwords do not collide in the dump.
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("reads legacy plaintext untouched", () => {
    expect(isEncrypted("plain-old-password")).toBe(false);
    expect(decryptSecret("plain-old-password")).toBe("plain-old-password");
  });

  it("does not double-encrypt", () => {
    const once = encryptSecret("secret");

    expect(encryptSecret(once)).toBe(once);
  });

  it("passes null and empty through both ways", () => {
    expect(encryptSecret(null)).toBeNull();
    expect(encryptSecret("")).toBeNull();
    expect(decryptSecret(null)).toBeNull();
    expect(decryptSecret("")).toBeNull();
  });

  it("rejects a tampered ciphertext", () => {
    const stored = encryptSecret("secret");
    const [prefix, iv, tag, ciphertext] = stored.split(".");
    const flipped = Buffer.from(ciphertext, "base64");
    flipped[0] ^= 0xff;

    const tampered = [prefix, iv, tag, flipped.toString("base64")].join(".");

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("refuses a key of the wrong length", () => {
    const good = process.env.CREDENTIAL_ENC_KEY;
    process.env.CREDENTIAL_ENC_KEY = Buffer.from("too-short").toString(
      "base64",
    );

    expect(() => encryptSecret("secret")).toThrow(/32 bytes/);

    process.env.CREDENTIAL_ENC_KEY = good;
  });
});
