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
 * True when a row identifies a person: a name and an email.
 *
 * Narrower than `rowErrors`: it asks nothing about validity, duplicates, or
 * the variables a template happens to want. It gates the trailing empty row —
 * who the lead is should be down before the grid offers somewhere to start the
 * next one, and the rest can be filled in any order after that. Company and
 * role are the group's rather than the row's, so the composer pairs this with
 * `isGroupComplete`.
 */
export function isRowFilled(row) {
  return Boolean(row?.name?.trim() && row?.email?.trim());
}

/**
 * The four fields a lead cannot exist without, marked with an asterisk in the
 * grid header. Two are the row's and two are its group's, but a lead is only a
 * lead once it has all four: who to write to, and what they are being written
 * to about.
 */
export const REQUIRED_FIELDS = [...BASE_COLUMNS, ...GROUP_FIELDS];

export const FIELD_LABELS = {
  name: "Name",
  email: "Email",
  company: "Company",
  role: "Role",
};

/**
 * Every problem with one row, keyed by the column it belongs to.
 *
 * Returns `{ [column]: { code, message } }` — empty when the row is good to
 * commit. Keying by column is what lets the grid put each message on the cell
 * that caused it instead of reporting "this row is wrong" and leaving the user
 * hunting; the codes let callers group and count without matching on prose.
 *
 * Codes:
 *   required  — one of the four, left empty
 *   invalid   — filled in, but not a usable value
 *   duplicate — this address is already spoken for
 *   template  — a variable the campaign's pitches reference, left empty
 *
 * Each error carries two forms. `message` is what the cell says when you hover
 * it, written to one person about one cell. `summary` is what a count is made
 * of — "Invalid email", not "That doesn't look like an email address" — because
 * a tally of full sentences reads as a wall rather than a list.
 *
 * `seen` is a Set of already-claimed emails, mutated as you walk the rows, so a
 * duplicate marks the *second* occurrence rather than both. Seed it with the
 * campaign's existing contacts and the same pass also catches re-adding someone
 * who is already in the campaign — which the CSV import this replaced never
 * did, so overlapping imports quietly created doubles.
 *
 * `group` carries company and role: they are stated once per group, so a row
 * cannot answer for them on its own. Passing no group therefore reports both as
 * missing, which is the safe direction for a caller that forgets.
 */
export function rowErrors(row, { columns = BASE_COLUMNS, group, seen } = {}) {
  const errors = {};
  const required = (field) => ({
    code: "required",
    message: `${FIELD_LABELS[field]} is required`,
    summary: `Missing ${FIELD_LABELS[field].toLowerCase()}`,
  });

  if (!String(row?.name ?? "").trim()) errors.name = required("name");

  const email = normaliseEmail(row?.email);
  if (!email) {
    errors.email = required("email");
  } else if (!isValidEmail(email)) {
    errors.email = {
      code: "invalid",
      message: "That doesn't look like an email address",
      summary: "Invalid email",
    };
  } else if (seen?.has(email)) {
    errors.email = {
      code: "duplicate",
      message: "This address is already in the campaign",
      summary: "Duplicate email",
    };
  }

  for (const field of GROUP_FIELDS) {
    if (!String(group?.[field] ?? "").trim()) errors[field] = required(field);
  }

  // Not one of the four, but still not optional: the pitches reference it, so
  // leaving it empty sends an email with a gap where personal text should be.
  for (const col of columns) {
    if (BASE_COLUMNS.includes(col) || GROUP_FIELDS.includes(col)) continue;
    if (!String(row?.personalization?.[col] ?? "").trim()) {
      errors[col] = {
        code: "template",
        message: `Your emails use {{${col}}}, so this can't be empty`,
        summary: `Missing ${col}`,
      };
    }
  }

  return errors;
}

export function hasErrors(errors) {
  return Object.keys(errors || {}).length > 0;
}

/**
 * Name one row's worst problem: incomplete | invalid | duplicate | ready.
 *
 * A summary of `rowErrors`, not a second opinion — everything deciding whether
 * a lead may be committed lives in one place, and this only picks the label.
 */
export function stateFromErrors(errors) {
  if (errors?.email?.code === "duplicate") return "duplicate";
  if (errors?.email?.code === "invalid") return "invalid";
  return hasErrors(errors) ? "incomplete" : "ready";
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
