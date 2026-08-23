/**
 * Header colours for lead groups.
 *
 * Each company/role group gets its own hue so a long draft reads as distinct
 * blocks rather than one undifferentiated stack — the colour is a landmark for
 * "which company am I looking at", nothing more, so every entry stays pale
 * enough to sit behind text.
 *
 * Assigned by position, not by hashing the company name: position guarantees
 * that two groups next to each other never land on the same colour, which is
 * the only place a collision would actually cost anything.
 *
 * Amber and yellow are deliberately absent. An incomplete group is flagged in
 * amber, and a palette that also uses it would make "needs attention" and
 * "third group in the list" look the same.
 *
 * Written as whole class strings rather than interpolated fragments so Tailwind
 * can see them — `bg-${hue}-50` would be stripped from the build.
 */
export const GROUP_COLORS = [
  {
    name: "indigo",
    header: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-900",
    muted: "text-indigo-700/70",
  },
  {
    name: "emerald",
    header: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-900",
    muted: "text-emerald-700/70",
  },
  {
    name: "sky",
    header: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-900",
    muted: "text-sky-700/70",
  },
  {
    name: "violet",
    header: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-900",
    muted: "text-violet-700/70",
  },
  {
    name: "rose",
    header: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-900",
    muted: "text-rose-700/70",
  },
  {
    name: "teal",
    header: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-900",
    muted: "text-teal-700/70",
  },
];

/** The colour for the group at this position, cycling once the palette runs out. */
export function groupColor(index) {
  return GROUP_COLORS[index % GROUP_COLORS.length];
}
