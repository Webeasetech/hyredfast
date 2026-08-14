import crypto from "crypto";
import Razorpay from "razorpay";

/**
 * Razorpay client + signature helpers. Server-only — the secret must never
 * reach the browser.
 *
 * Test vs live is decided purely by which keys are in the environment
 * (`rzp_test_…` vs `rzp_live_…`). There is deliberately no RAZORPAY_MODE flag:
 * one source of truth cannot drift out of sync with itself.
 *
 * There is also no NEXT_PUBLIC_ key id. `NEXT_PUBLIC_*` is inlined at build
 * time, which under Docker would mean threading a build arg through
 * docker-compose. The key id is public anyway, so the order-create route just
 * returns it in its response instead.
 */

let client;

export function getRazorpay() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET — see docs/payments-razorpay.md",
    );
  }

  if (!client) client = new Razorpay({ key_id, key_secret });
  return client;
}

export function getKeyId() {
  return process.env.RAZORPAY_KEY_ID;
}

export function isTestMode() {
  return (process.env.RAZORPAY_KEY_ID || "").startsWith("rzp_test_");
}

/** "test" | "live" — surfaced to the UI so it can show a test-mode banner. */
export function getMode() {
  return isTestMode() ? "test" : "live";
}

/**
 * Warns when a production-looking APP_URL is paired with test keys (or the
 * reverse). Cheap guard against shipping a deploy that silently takes no money
 * — or worse, takes real money from a staging box.
 */
export function warnOnModeMismatch() {
  const appUrl = process.env.APP_URL || "";
  const isLocal = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
  if (!isLocal && isTestMode()) {
    console.warn(
      `[razorpay] TEST keys are in use but APP_URL is ${appUrl} — no real payments will be captured.`,
    );
  }
}

function timingSafeEqualHex(a, b) {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch, so check that first.
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies the signature Razorpay Checkout hands back to the browser.
 * Payload is `${order_id}|${payment_id}`, HMAC-SHA256 keyed with KEY_SECRET.
 */
export function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return timingSafeEqualHex(expected, signature);
}

/**
 * Verifies a webhook delivery. Signed over the EXACT raw request body with
 * RAZORPAY_WEBHOOK_SECRET (a different secret from KEY_SECRET — you choose it
 * in the dashboard). Callers must pass the raw text: re-serialising parsed JSON
 * changes key order and whitespace, and the HMAC will never match.
 */
export function verifyWebhookSignature({ rawBody, signature }) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured");
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return timingSafeEqualHex(expected, signature);
}
