/**
 * The company/role folding rule.
 *
 * One company is one slot against the quota, so "Bayer", "bayer" and "Bayer  "
 * must collapse to the same row or the billing unit is whatever the user
 * happened to type. This is the only definition of that rule in the JavaScript
 * — the backfill in `20260829000000_company_application_quota` inlines the same
 * regex in SQL because a migration cannot import, and the two must stay in step.
 */

/** Lowercase, drop punctuation, collapse whitespace. */
function fold(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Uniqueness key for a company within one user. */
export function companySlug(name) {
  return fold(name);
}

/**
 * Uniqueness key for a role within one company and campaign. A blank role folds
 * to "", so a company holds one role-less application rather than a pile.
 */
export function roleSlug(role) {
  return fold(role);
}

/** The placeholder company for contacts added without one. Never billed. */
export const UNASSIGNED_SLUG = "__unassigned__";
export const UNASSIGNED_NAME = "(Unassigned)";

/** Whether a company row consumes a quota slot. */
export function isBillable(slug) {
  return Boolean(slug) && slug !== UNASSIGNED_SLUG;
}
