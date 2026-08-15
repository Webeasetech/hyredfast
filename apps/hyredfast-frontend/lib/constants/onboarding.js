/**
 * The signup questionnaire.
 *
 * Single source of truth for both sides: the stepper renders from these lists,
 * and the API validates submitted values against them. Anything the user types
 * into an "add your own" field bypasses the value check by design — that only
 * applies to `targetRoles`, which is deliberately free-form.
 *
 * Values are stored as plain strings (repo convention, see Payment.status)
 * rather than Prisma enums, so adding an option later is a constants edit and
 * not a migration.
 */

export const SENIORITY = [
  { value: "INTERN", label: "Student / Intern" },
  { value: "JUNIOR", label: "Junior", hint: "0-2 yrs" },
  { value: "MID", label: "Mid-level", hint: "2-5 yrs" },
  { value: "SENIOR", label: "Senior", hint: "5-8 yrs" },
  { value: "LEAD", label: "Lead / Staff+", hint: "8+ yrs" },
];

export const EMPLOYMENT_TYPES = [
  { value: "FULL_TIME", label: "Full-time job" },
  { value: "INTERNSHIP", label: "Internship" },
  { value: "CONTRACT", label: "Contract" },
  { value: "FREELANCE", label: "Freelance" },
  { value: "PART_TIME", label: "Part-time" },
];

export const WORK_MODES = [
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "ONSITE", label: "On-site" },
];

export const URGENCY = [
  {
    value: "ACTIVELY_LOOKING",
    label: "Actively looking",
    hint: "Applying right now",
  },
  {
    value: "NOTICE_SERVED",
    label: "On notice period",
    hint: "Have a start-by date",
  },
  { value: "LAID_OFF", label: "Between roles", hint: "Free to start soon" },
  { value: "PASSIVE", label: "Keeping options open", hint: "No rush" },
];

export const BLOCKERS = [
  { value: "FINDING_CONTACTS", label: "Finding the right person to email" },
  { value: "WRITING_EMAILS", label: "Writing emails that don't sound generic" },
  { value: "NO_REPLIES", label: "Sending a lot, hearing nothing back" },
  { value: "NO_INTERVIEWS", label: "Replies come, interviews don't" },
];

/** Starting points for the role question. Users can add their own. */
export const ROLE_SUGGESTIONS = [
  "Software Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Engineer",
  "DevOps Engineer",
  "AI / ML Engineer",
  "Data Engineer",
  "Data Analyst",
  "Mobile Engineer",
  "QA Engineer",
  "Product Manager",
  "UI / UX Designer",
];

/** Résumé parsing accepts these only. Anything else is rejected at the door. */
export const RESUME_ACCEPT = ".pdf,.docx,.txt";
export const RESUME_MAX_BYTES = 5 * 1024 * 1024;

const values = (list) => list.map((o) => o.value);

export const SENIORITY_VALUES = values(SENIORITY);
export const EMPLOYMENT_TYPE_VALUES = values(EMPLOYMENT_TYPES);
export const WORK_MODE_VALUES = values(WORK_MODES);
export const URGENCY_VALUES = values(URGENCY);
export const BLOCKER_VALUES = values(BLOCKERS);
