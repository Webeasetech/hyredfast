/**
 * Billing plans.
 *
 * The billing unit is one EMAIL SENT. One credit, one email, debited in the
 * same transaction that advances the lead's stage.
 *
 * This replaced per-company billing, which could never answer "when is a
 * company consumed?" honestly — the old code charged the moment a company name
 * was typed, so typing "Bayer" and deleting it cost a slot with nothing sent
 * and no defensible way to refund. A send is discrete and observable, and the
 * pipeline was already debiting it.
 *
 * The term is three months because that is what a job hunt is scoped to.
 * Credits do NOT refill monthly — they are a lump, spent down, and whatever is
 * unspent expires with the term.
 *
 * Amounts are in paise (Razorpay's unit) and are the FINAL payable price: ₹699
 * is what the user is charged, with no tax line added at checkout.
 *
 * GST: services are only liable once aggregate turnover passes ₹20 lakh a year
 * (₹10 lakh in special-category states), which at ₹699 a quarter is roughly 715
 * concurrent paying users. Below that there is no GST to collect, so ₹699 is
 * ₹699. On crossing it, the choice is to absorb the 18% (net falls to ~₹592
 * before Razorpay) or raise the displayed price — do not add a tax line to a
 * consumer checkout, the all-in figure is what an Indian B2C buyer expects.
 * Confirm with a CA before launch; place of supply can change the answer.
 *
 * This object is the only place a price lives — the order-create route reads
 * the amount from here and never from the request body, so a tampered client
 * cannot buy a term for ₹1.
 */

/** Term length. Everything about expiry derives from this. */
export const TERM_MONTHS = 3;

export const PLANS = {
  /**
   * ₹699 for three months, 15,000 emails.
   *
   * Sizing: 300 companies × 10 contacts × 5 follow-up stages = 15,000 sends,
   * which is what the previous company-based plan allowed at its ceiling. The
   * allowance did not change, only the unit it is counted in.
   *
   * Unit economics: sending costs us nothing (the user's own SMTP) and so does
   * verification (their own MillionVerifier key). The real cost is shared
   * infrastructure — roughly ₹7,000/month for Hetzner, Neon and the domain at
   * 200–300 users, so ₹70–105 per user per term, plus about 6 MB of stored
   * message bodies for a user who sends all 15,000.
   *
   * Call it ₹120 per user per term. Below the GST threshold ₹699 nets ~₹683
   * after Razorpay's ~2.4%, so the margin is comfortable at 200 users and
   * there is room to discount at launch. Once GST applies it nets ~₹578,
   * which still holds.
   */
  quarterly: {
    id: "quarterly",
    label: "3 months",
    amount: 69900, // ₹699
    termMonths: TERM_MONTHS,
    credits: 15000,
    description: "Three months of outreach, 15,000 emails",
  },

  /**
   * ₹299 for 5,000 more emails.
   *
   * Priced at ₹0.0598/email against the plan's ₹0.0466, so topping up costs
   * about 28% more per send than buying the term did. Enough to make the term the
   * obvious purchase, not enough to feel like a penalty. Does not extend the
   * term — the credits expire with it.
   */
  topup: {
    id: "topup",
    label: "Top-up",
    amount: 29900, // ₹299
    credits: 5000,
    description: "5,000 more emails on your current plan",
  },
};

export const PLAN_IDS = Object.keys(PLANS);

/** Credits granted on signup. Flip this if we ever want a trial. */
export const FREE_TRIAL_CREDITS = 0;

/**
 * Contacts allowed at one company at a time.
 *
 * Not a billing limit — credits are the only one of those. This is a
 * DELIVERABILITY guardrail: twenty cold emails into a single recipient domain
 * inside one sending window is what trips corporate spam filters, and the
 * account that gets burned is the user's own job-hunting inbox.
 *
 * Counted against contacts that are still being emailed (PENDING or RUNNING),
 * never against every contact ever added. Finish a sequence, get a reply, or
 * bounce and the slot frees, so a new posting at the same company months later
 * starts with the full allowance. There is no expiry rule to maintain: it
 * heals itself.
 */
export const MAX_ACTIVE_CONTACTS_PER_COMPANY = 10;

/** Statuses that still count against the per-company contact limit. */
export const ACTIVE_CONTACT_STATUSES = ["PENDING", "RUNNING"];

/** ₹ display helper — amounts are stored in paise. */
export function formatInr(paise) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
