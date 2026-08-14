/**
 * IANA timezone helpers. The send scheduler resolves every delivery window and
 * follow-up date in the user's timezone, so an account without a valid one
 * never sends.
 */

export function isValidTimezone(value) {
  if (typeof value !== "string" || value.trim() === "") return false;

  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function listTimezones() {
  return Intl.supportedValuesOf("timeZone");
}

export function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
