import { z } from "zod";
import {
  SENIORITY_VALUES,
  EMPLOYMENT_TYPE_VALUES,
  WORK_MODE_VALUES,
  URGENCY_VALUES,
  BLOCKER_VALUES,
} from "@/lib/constants/onboarding";

/**
 * Server-side shape of the questionnaire, shared by the onboarding submit and
 * the settings edit.
 *
 * Every field is optional because every question is skippable, and the two
 * callers send different subsets. `targetRoles` is the one free-form field —
 * users add roles we never listed — so it is length-capped instead of
 * value-checked.
 */
const trimmedList = (max, itemMax) =>
  z
    .array(z.string().trim().min(1).max(itemMax))
    .max(max)
    .transform((list) => [...new Set(list)]);

export const profileSchema = z.object({
  targetRoles: trimmedList(8, 60).optional(),
  seniority: z.enum(SENIORITY_VALUES).nullable().optional(),
  employmentTypes: z.array(z.enum(EMPLOYMENT_TYPE_VALUES)).optional(),
  country: z.string().trim().max(80).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  workModes: z.array(z.enum(WORK_MODE_VALUES)).optional(),
  willRelocate: z.boolean().nullable().optional(),
  needsSponsorship: z.boolean().nullable().optional(),
  urgency: z.enum(URGENCY_VALUES).nullable().optional(),
  blockers: z.array(z.enum(BLOCKER_VALUES)).optional(),
  // Comes straight from /api/onboarding/resume, which is our own route, so the
  // contents are already ours. Stored as-is.
  resumeParsed: z.record(z.any()).nullable().optional(),
  resumeFileName: z.string().trim().max(255).nullable().optional(),
});

/** Fields the client is allowed to write, mapped onto Prisma column names. */
export function toProfileData(parsed) {
  const data = { ...parsed };

  // A résumé is only "parsed" when there is something to show for it, so the
  // timestamp is derived here rather than trusted from the client.
  if ("resumeParsed" in parsed) {
    data.resumeParsedAt = parsed.resumeParsed ? new Date() : null;
  }

  return data;
}

/** The public shape of a profile. No internal ids or timestamps leak out. */
export const PROFILE_SELECT = {
  targetRoles: true,
  seniority: true,
  employmentTypes: true,
  country: true,
  city: true,
  workModes: true,
  willRelocate: true,
  needsSponsorship: true,
  urgency: true,
  blockers: true,
  resumeParsed: true,
  resumeFileName: true,
  resumeParsedAt: true,
  completedAt: true,
};
