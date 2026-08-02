/**
 * Billing plans.
 *
 * The billing unit is the COMPANY — one-time purchases, no tiers, no
 * subscription. "Credits" are an internal metering detail and must never
 * surface in the UI.
 *
 * Amounts are in paise (Razorpay's unit) and are GST-inclusive: ₹999 is what
 * the user pays. This object is the only place a price lives — the order-create
 * route reads the amount from here and never from the request body, so a
 * tampered client cannot buy 100 companies for ₹1.
 */
export const PLANS = {
  starter: {
    id: "starter",
    label: "Starter",
    amount: 99900, // ₹999
    companies: 100,
    description: "Everything you need for a full job hunt",
  },
  topup: {
    id: "topup",
    label: "Top-up",
    amount: 49900, // ₹499
    companies: 50,
    description: "Add more companies to an existing account",
  },
};

export const PLAN_IDS = Object.keys(PLANS);

/**
 * Companies granted on signup. Was `credits: 500, aiCredits: 500`, which was
 * real money given away to anyone who could POST to /api/auth/signup. Flip this
 * to a small number if we ever want a trial.
 */
export const FREE_TRIAL_COMPANIES = 0;

/** Hard cap on contacts per company, enforced wherever contacts are added. */
export const MAX_CONTACTS_PER_COMPANY = 10;

/** ₹ display helper — amounts are stored in paise. */
export function formatInr(paise) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
