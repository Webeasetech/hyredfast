/**
 * Shared rules for the lead composer.
 *
 * The composer's central rule is that saving and validating are separate: a
 * draft row may hold anything, including nonsense, and every check below is
 * advisory right up until commit. A grid that refuses to store a half-typed
 * email loses the user's work the moment they close the tab, which is the one
 * thing drafts exist to prevent.
 */

/** Columns every grid starts with, in order. Both map straight to CampaignLead. */
export const BASE_COLUMNS = ["name", "email"];

/**
 * Stated once per group, never per row.
 *
 * Every lead in a group shares a company and a role, so asking for them on each
 * row is asking the same question over and over. They are copied onto each
 * contact's personalization at commit, so a template using those variables
 * still renders per lead — the grid just never shows them as columns.
 */
export const GROUP_FIELDS = ["company", "role"];

/**
 * Pull the personalization variables a campaign's pitches actually reference.
 *
 * The templates already declare what a lead needs — `{{company}}` in a pitch
 * body means every lead needs a company — so the grid opens with those columns
 * instead of making the user guess. Matches `{{variable}}` and
 * `{{variable|"fallback"}}`.
 */
export function extractVariablesFromPitches(pitches) {
  if (!pitches?.length) return [];
  const variableRegex = /\{\{(\w+)(?:\|[^}]*)?\}\}/g;
  const vars = new Set();

  for (const pitch of pitches) {
    // `dynamicSubject` is the Prisma field; the column is dynamic_subject. The
    // camelCase name is the one that exists on the object.
    const texts = [pitch.message, pitch.subject, pitch.dynamicSubject].filter(
      Boolean,
    );
    for (const text of texts) {
      let match;
      while ((match = variableRegex.exec(text)) !== null) vars.add(match[1]);
    }
  }

  // name and email are their own columns already.
  return [...vars].filter((v) => !BASE_COLUMNS.includes(v));
}

/** Column list for a fresh draft: the base pair plus whatever the pitches want. */
export function seedColumns(pitches) {
  return [...BASE_COLUMNS, ...extractVariablesFromPitches(pitches)];
}

/**
 * Deliberately permissive. This is the gate for *sending*, not for typing, and
 * a stricter pattern here only means rejecting addresses that deliver fine.
 */
export function isValidEmail(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(trimmed);
}

export function normaliseEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** A group can only produce contacts once it says who they are being written for. */
export function isGroupComplete(group) {
  return GROUP_FIELDS.every((f) => String(group?.[f] ?? "").trim());
}

/**
 * The columns a group's grid renders, in order.
 *
 * Company and role always appear, whether or not a template happens to
 * reference them — they are shown read-only, mirroring the group header, so a
 * row still reads as a complete record without inviting an edit that would only
 * apply to one lead of the group.
 */
export function displayColumns(columns) {
  const rest = columns.filter(
    (c) => !BASE_COLUMNS.includes(c) && !GROUP_FIELDS.includes(c),
  );
  return [...BASE_COLUMNS, ...GROUP_FIELDS, ...rest];
}

/**
 * The subset a user can actually type into — what a pasted block maps onto.
 *
 * Pasting has to skip the read-only columns, or every cell after them lands one
 * column to the right of where it belongs.
 */
export function editableColumns(columns) {
  return displayColumns(columns).filter((c) => !GROUP_FIELDS.includes(c));
}

/**
 * Fold rows into company/role groups, in first-appearance order.
 *
 * Grouping is derived rather than stored: company and role live in each row's
 * personalization, which is what lets every existing endpoint stay exactly as
 * it is. The consequence is that a group has no identity beyond its two values,
 * so two unnamed groups would be indistinguishable — the composer prevents
 * creating a second one until the first is named.
 */
export function groupRows(rows = []) {
  const groups = [];
  const byKey = new Map();

  for (const row of rows) {
    const company = String(row?.personalization?.company ?? "").trim();
    const role = String(row?.personalization?.role ?? "").trim();
    const key = `${company.toLowerCase()}\u0000${role.toLowerCase()}`;

    let group = byKey.get(key);
    if (!group) {
      group = { key, company, role, rows: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.rows.push(row);
  }

  return groups;
}

/**
 * True when a row holds nothing the user typed into it.
 *
 * Group fields are excluded on purpose: every row in a named group carries its
 * company and role, stamped there when the row was created. Counting those as
 * content would make a freshly added blank row look filled in — which reads as
 * an incomplete lead, and makes "does this group need a trailing blank row?"
 * answer yes forever, appending rows without end.
 */
export function isBlankRow(row, columns = BASE_COLUMNS) {
  if (row?.name?.trim()) return false;
  if (row?.email?.trim()) return false;
  return !columns
    .filter((c) => !GROUP_FIELDS.includes(c))
    .some((c) => String(row?.personalization?.[c] ?? "").trim());
}

/**
 * True when a row has something in every column a user can type into.
 *
 * Narrower than `classifyRow`: it asks nothing about validity or duplicates,
 * only whether the row still has a blank in it. It gates the trailing empty
 * row — a half-typed lead should be finished before the grid offers somewhere
 * to start the next one. Company and role are excluded because they are the
 * group's, not the row's; the composer checks those with `isGroupComplete`.
 */
export function isRowFilled(row, columns = BASE_COLUMNS) {
  if (!row?.name?.trim()) return false;
  if (!row?.email?.trim()) return false;
  return columns
    .filter((c) => !BASE_COLUMNS.includes(c) && !GROUP_FIELDS.includes(c))
    .every((c) => String(row?.personalization?.[c] ?? "").trim());
}

/**
 * Classify one row.
 *
 * `seen` is a Set of already-claimed emails, mutated as you walk the rows, so a
 * duplicate marks the *second* occurrence rather than both. Seed it with the
 * campaign's existing contacts and the same pass also catches re-adding someone
 * who is already in the campaign — which today's CSV import never did, so
 * overlapping imports quietly created doubles.
 *
 * Returns one of: blank | incomplete | invalid | duplicate | ready
 */
export function classifyRow(row, { columns = BASE_COLUMNS, seen } = {}) {
  if (isBlankRow(row, columns)) return "blank";

  const email = normaliseEmail(row?.email);
  if (!email) return "incomplete";
  if (!isValidEmail(email)) return "invalid";
  if (seen?.has(email)) return "duplicate";

  // Every column the templates asked for has to be filled, or the lead goes out
  // with a visible {{placeholder}} in the body.
  const missing = columns
    .filter((c) => !BASE_COLUMNS.includes(c))
    .some((c) => !String(row?.personalization?.[c] ?? "").trim());
  if (missing) return "incomplete";

  return "ready";
}

export const STATE_LABELS = {
  blank: "Empty",
  incomplete: "Incomplete",
  invalid: "Invalid email",
  duplicate: "Duplicate",
  ready: "Ready",
  needsGroup: "Company and role needed",
  // Raised at commit, not while typing: both depend on server state the grid
  // does not hold (this month's quota, and how many contacts the application
  // already has).
  quota: "Company limit reached for this month",
  contactCap: "This company already has the maximum contacts",
};

/** Only `ready` rows are eligible; everything else stays behind in the draft. */
export function isCommittable(state) {
  return state === "ready";
}
