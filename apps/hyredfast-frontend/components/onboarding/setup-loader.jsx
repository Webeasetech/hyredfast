"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * The hand-off screen between the last question and the app.
 *
 * The mark is the HyredFast icon redrawn as SVG: the H holds still while the
 * two heads above it bob in turn. It is a PNG everywhere else in the app, which
 * can't animate, so it is rebuilt in shapes here rather than imported.
 */

// Held long enough to read, short enough not to feel stuck.
const LINE_MS = 1500;

const LINES = [
  "Saving your answers",
  "Setting up your workspace",
  "Tuning your outreach templates",
  "Almost there",
];

export function SetupLoader() {
  const [line, setLine] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      // Sticks on the last line rather than looping, so a slow request doesn't
      // look like it restarted.
      () => setLine((i) => Math.min(i + 1, LINES.length - 1)),
      LINE_MS,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background"
    >
      <LogoMark />

      <div className="h-6 text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={line}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="font-medium text-muted-foreground"
          >
            {LINES[line]}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// The two heads, offset so they bob alternately rather than in unison.
const HEADS = [
  { cx: 24, delay: 0 },
  { cx: 96, delay: 0.45 },
];

function LogoMark() {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="currentColor"
      className="size-28 text-primary"
      aria-label="Setting up"
      role="img"
    >
      {HEADS.map((head) => (
        <motion.circle
          key={head.cx}
          cx={head.cx}
          cy="15"
          r="13"
          animate={{ y: [0, -5, 0] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: head.delay,
          }}
        />
      ))}

      <motion.g
        style={{ transformOrigin: "60px 75px" }}
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <rect x="10" y="34" width="28" height="82" rx="14" />
        <rect x="82" y="34" width="28" height="82" rx="14" />
        <rect x="34" y="59" width="52" height="24" />
      </motion.g>
    </svg>
  );
}
