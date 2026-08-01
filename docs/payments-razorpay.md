# Razorpay setup

Payments run on Razorpay (INR, UPI + cards + netbanking). The account is under
**Webease Tech** (GSTIN `08DQPPA8311G1ZU`). While the account is under review,
only **test mode** works — that is fine, the code path is identical.

## What we sell

The billing unit is the **company**. One-time purchases, no subscription, no
tiers. Prices live in one place, [`lib/constants/plans.js`](../apps/denshees-frontend/lib/constants/plans.js):

| Plan | Price | Companies |
| --- | --- | --- |
| `starter` | ₹999 | 100 |
| `topup` | ₹499 | 50 |

Amounts are in **paise** and are GST-inclusive. The order-create route reads the
amount from this constant and never from the request body — the client sends
only a `planId`.

## Environment variables

Three variables, same names in both modes. **Test vs live is decided by the key
prefix alone** (`rzp_test_…` / `rzp_live_…`); there is deliberately no
`RAZORPAY_MODE` flag to drift out of sync.

| Variable | Where it comes from |
| --- | --- |
| `RAZORPAY_KEY_ID` | Dashboard → Account & Settings → API Keys → Generate Key. Starts `rzp_test_` or `rzp_live_`. |
| `RAZORPAY_KEY_SECRET` | Shown **once**, at key generation. Regenerate if lost. |
| `RAZORPAY_WEBHOOK_SECRET` | **You choose this string** when creating the webhook (below). It is *not* the key secret. |

Set them in:

- **Local** — `apps/denshees-frontend/.env` and the root `.env` (test keys only)
- **Deployed** — GitHub repo secrets, which `deploy.yml` writes into the
  server's `.env`; `docker-compose.yml` passes them to the frontend container

There is no `NEXT_PUBLIC_RAZORPAY_KEY_ID`. `NEXT_PUBLIC_*` is inlined at build
time, which under Docker means threading a build arg through compose for a value
that is public anyway. `/api/payments/create` returns `keyId` in its response
instead.

## Webhook

Dashboard → Settings → Webhooks → **Add New Webhook**:

- **URL** — `$APP_URL/api/webhooks/razorpay`
- **Secret** — any strong random string; this becomes `RAZORPAY_WEBHOOK_SECRET`
- **Active events** — `payment.captured`, `payment.failed`, `refund.processed`

The webhook is the **authoritative** fulfilment path: it fires even if the user
closes the tab mid-payment. The browser also posts to `/api/payments/verify` the
moment Checkout closes, so the balance updates immediately. Both call the same
idempotent `fulfilPayment()`, and exactly one grants — see
[`lib/payments/fulfil.js`](../apps/denshees-frontend/lib/payments/fulfil.js).

### Local webhook testing

Razorpay needs a public URL, so tunnel:

```sh
cloudflared tunnel --url http://localhost:3000   # or: ngrok http 3000
```

Register the tunnel URL + `/api/webhooks/razorpay` as a second webhook in the
dashboard. Delete it when you're done — a dead tunnel URL just accumulates
failed deliveries.

## Test instruments

| Method | Value |
| --- | --- |
| UPI success | `success@razorpay` |
| UPI failure | `failure@razorpay` |
| Card | `4111 1111 1111 1111`, any future expiry, any CVV |
| Netbanking | Pick any bank, then "Success" on the simulator page |

## Flow

```
POST /api/payments/create   → verifyAuth, amount from PLANS, razorpay.orders.create
                              → Payment row (status CREATED) → { orderId, keyId, mode }
browser                     → Razorpay Checkout modal
POST /api/payments/verify   → HMAC(order_id|payment_id, KEY_SECRET), ownership check
                              → fulfilPayment()  ← fast path
POST /api/webhooks/razorpay → HMAC(raw body, WEBHOOK_SECRET), dedupe on event id
                              → fulfilPayment()  ← authoritative path
```

Idempotency is a conditional `updateMany` guarded on `status: "CREATED"`, which
is an atomic compare-and-set at the row level. A read-then-write would let both
paths see `CREATED` and both increment.

## Going live

1. Razorpay account review completes and live mode is enabled
2. Generate **live** API keys
3. Update the `RAZORPAY_*` GitHub secrets to the `rzp_live_` values
4. Register the production webhook against the live-mode dashboard — test and
   live webhooks are configured separately
5. Redeploy

The app logs a warning at order-create time if a non-localhost `APP_URL` is
paired with test keys.
