"use client";

import { motion } from "framer-motion";

/**
 * One line drawing per question, animated on entry.
 *
 * Each is a plain stroked SVG on `currentColor`, so it picks up the brand from
 * whatever wraps it and needs no dark-mode variant. The draw-on animation runs
 * off pathLength, which framer-motion normalises to 0-1 regardless of the
 * actual path geometry.
 */

const draw = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: (i = 0) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { delay: i * 0.12, duration: 0.5, ease: "easeInOut" },
      opacity: { delay: i * 0.12, duration: 0.15 },
    },
  }),
};

function Frame({ children }) {
  return (
    <motion.svg
      viewBox="0 0 64 64"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-14 text-primary"
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.svg>
  );
}

// Concentric aperture — the roles you are aiming at.
function RolesArt() {
  return (
    <Frame>
      <motion.circle
        cx="32"
        cy="32"
        r="22"
        stroke="currentColor"
        variants={draw}
        custom={0}
      />
      <motion.circle
        cx="32"
        cy="32"
        r="13"
        stroke="currentColor"
        opacity="0.5"
        variants={draw}
        custom={1}
      />
      <motion.circle
        cx="32"
        cy="32"
        r="4"
        stroke="currentColor"
        variants={draw}
        custom={2}
      />
    </Frame>
  );
}

// Rising steps — seniority.
function SeniorityArt() {
  return (
    <Frame>
      <motion.path
        d="M12 48V38"
        stroke="currentColor"
        opacity="0.5"
        variants={draw}
        custom={0}
      />
      <motion.path
        d="M24 48V29"
        stroke="currentColor"
        opacity="0.7"
        variants={draw}
        custom={1}
      />
      <motion.path d="M36 48V20" stroke="currentColor" variants={draw} custom={2} />
      <motion.path d="M48 48V11" stroke="currentColor" variants={draw} custom={3} />
      <motion.path
        d="M6 54h52"
        stroke="currentColor"
        opacity="0.3"
        variants={draw}
        custom={4}
      />
    </Frame>
  );
}

// Two interlocking brackets — the shape of the arrangement.
function EmploymentArt() {
  return (
    <Frame>
      <motion.path
        d="M26 14H18a6 6 0 0 0-6 6v24a6 6 0 0 0 6 6h8"
        stroke="currentColor"
        variants={draw}
        custom={0}
      />
      <motion.path
        d="M38 14h8a6 6 0 0 1 6 6v24a6 6 0 0 1-6 6h-8"
        stroke="currentColor"
        opacity="0.5"
        variants={draw}
        custom={1}
      />
      <motion.path
        d="M32 24v16"
        stroke="currentColor"
        variants={draw}
        custom={2}
      />
    </Frame>
  );
}

// Pin over a horizon line — where you work from.
function LocationArt() {
  return (
    <Frame>
      <motion.path
        d="M32 10c-7 0-12 5.4-12 12 0 8.6 12 22 12 22s12-13.4 12-22c0-6.6-5-12-12-12Z"
        stroke="currentColor"
        variants={draw}
        custom={0}
      />
      <motion.circle
        cx="32"
        cy="22"
        r="4.5"
        stroke="currentColor"
        variants={draw}
        custom={1}
      />
      <motion.path
        d="M12 54h40"
        stroke="currentColor"
        opacity="0.3"
        variants={draw}
        custom={2}
      />
    </Frame>
  );
}

// Clock face — how urgent the search is.
function UrgencyArt() {
  return (
    <Frame>
      <motion.circle
        cx="32"
        cy="32"
        r="21"
        stroke="currentColor"
        variants={draw}
        custom={0}
      />
      <motion.path
        d="M32 19v14l9 6"
        stroke="currentColor"
        variants={draw}
        custom={1}
      />
    </Frame>
  );
}

// A page with a folded corner — the résumé.
function ResumeArt() {
  return (
    <Frame>
      <motion.path
        d="M38 8H20a4 4 0 0 0-4 4v40a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4V18L38 8Z"
        stroke="currentColor"
        variants={draw}
        custom={0}
      />
      <motion.path
        d="M38 8v10h10"
        stroke="currentColor"
        opacity="0.5"
        variants={draw}
        custom={1}
      />
      <motion.path
        d="M24 30h16M24 38h16M24 46h9"
        stroke="currentColor"
        opacity="0.5"
        variants={draw}
        custom={2}
      />
    </Frame>
  );
}

const ART = {
  roles: RolesArt,
  seniority: SeniorityArt,
  employment: EmploymentArt,
  location: LocationArt,
  urgency: UrgencyArt,
  resume: ResumeArt,
};

export function StepArt({ name }) {
  const Art = ART[name];
  return Art ? <Art /> : null;
}

/**
 * Faint dot grid behind the whole flow. Purely decorative, and masked so it
 * fades out before it reaches the content column.
 */
export function OnboardingBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <svg className="size-full text-foreground/[0.06]">
        <defs>
          <pattern
            id="onboarding-dots"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
          </pattern>
          <radialGradient id="onboarding-fade" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="100%" stopColor="white" stopOpacity="1" />
          </radialGradient>
          <mask id="onboarding-mask">
            <rect width="100%" height="100%" fill="url(#onboarding-fade)" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="url(#onboarding-dots)"
          mask="url(#onboarding-mask)"
        />
      </svg>
    </div>
  );
}
