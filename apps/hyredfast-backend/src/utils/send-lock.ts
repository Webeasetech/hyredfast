/**
 * Per-credential send spacing.
 *
 * The rate limited resource is the sender's own mailbox, not the platform, so
 * the spacing belongs on the credential rather than on the worker. Holding a
 * key per credential lets different mailboxes send at the same time while any
 * single one still sends no faster than once per window.
 *
 * The lock is deliberately never released. Its expiry IS the spacing: releasing
 * it after a send would let the same mailbox go again immediately.
 */

import { redis } from "../config/redis.js";

export const SEND_SPACING_SECONDS = 25;

/** Raised when a send cannot proceed because its mailbox went too recently. */
export class CredentialBusyError extends Error {
  readonly retryAfterMs: number;

  constructor(credId: string, retryAfterMs: number) {
    super(`Credential ${credId} sent too recently`);
    this.name = "CredentialBusyError";
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Claims a mailbox for one send.
 * @param credId - Credential to claim.
 * @returns True when this caller won the mailbox, false when it is busy.
 */
export async function acquireCredentialLock(credId: string): Promise<boolean> {
  const result = await redis.set(
    lockKey(credId),
    "1",
    "EX",
    SEND_SPACING_SECONDS,
    "NX",
  );

  return result === "OK";
}

/**
 * How long to wait before trying these mailboxes again, based on whichever
 * frees up first. Jittered, because everything queued behind one mailbox wakes
 * the moment its lock expires and would otherwise collide all over again.
 *
 * @param credIds - Credentials the send could have used.
 * @returns Delay in milliseconds.
 */
export async function credentialRetryDelay(
  credIds: string[],
): Promise<number> {
  const ttls = await Promise.all(
    credIds.map((credId) => redis.pttl(lockKey(credId))),
  );

  // pttl answers -2 for a key that has already gone and -1 for one with no
  // expiry set. Neither is something to wait on.
  const soonest = Math.min(...ttls.map((ttl) => (ttl > 0 ? ttl : 0)));

  return soonest + 500 + Math.floor(Math.random() * 3000);
}

function lockKey(credId: string): string {
  return `sendlock:cred:${credId}`;
}
