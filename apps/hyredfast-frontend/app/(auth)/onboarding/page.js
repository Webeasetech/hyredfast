"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import useAuthStore from "@/store/auth.store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionGrid } from "@/components/onboarding/option-grid";
import { ResumeUpload } from "@/components/onboarding/resume-upload";
import {
  SetupLoader,
  setupLoaderDuration,
} from "@/components/onboarding/setup-loader";
import { OnboardingBackdrop } from "@/components/onboarding/onboarding-backdrop";
import {
  SENIORITY,
  EMPLOYMENT_TYPES,
  WORK_MODES,
  URGENCY,
  BLOCKERS,
  ROLE_SUGGESTIONS,
} from "@/lib/constants/onboarding";

const MAX_ROLES = 3;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reads the picked résumé. Returns null on any failure, because a résumé that
 * won't parse must not cost the user the answers they already gave — they land
 * in the app either way and can fill the gaps in Settings.
 */
async function parseResume(file, token) {
  const body = new FormData();
  body.append("file", file);

  const res = await fetch("/api/onboarding/resume", {
    method: "POST",
    headers: { Authorization: token },
    body,
  });

  if (!res.ok) return null;
  return res.json();
}

const EMPTY = {
  targetRoles: [],
  seniority: null,
  employmentTypes: [],
  country: "",
  city: "",
  workModes: [],
  willRelocate: null,
  needsSponsorship: null,
  urgency: null,
  blockers: [],
};

export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated, user, token, updateUser } = useAuthStore();

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState(EMPTY);
  const [resumeFile, setResumeFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated) router.push("/login");
    else if (user?.isSetup) router.push("/");
  }, [mounted, isAuthenticated, user, router]);

  const set = (patch) => setAnswers((prev) => ({ ...prev, ...patch }));

  const goTo = (next) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  // A single-select question that stands alone moves on by itself, so answering
  // it is one tap instead of tap-then-Continue. Scheduled from the answer
  // handler rather than from the answer's value, or stepping back onto an
  // already-answered question would bounce the user straight forward again.
  const advanceTimer = useRef(null);
  const scheduleAdvance = () => {
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => goTo(step + 1), 220);
  };
  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  const steps = buildSteps({
    answers,
    set,
    resumeFile,
    setResumeFile,
    scheduleAdvance,
  });
  const current = steps[step];
  const isLast = step === steps.length - 1;

  const finish = async () => {
    try {
      setIsSaving(true);

      // Both the parse and the save happen behind the hand-off screen, where
      // the user is already waiting, rather than on the question itself.
      const work = (async () => {
        const resume = resumeFile
          ? await parseResume(resumeFile, token).catch(() => null)
          : null;

        if (resumeFile && !resume) {
          toast.error(
            "We couldn't read your résumé. Everything else was saved, and you can add those details in Settings.",
          );
        }

        return fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: token },
          body: JSON.stringify({
            ...answers,
            country: answers.country.trim() || null,
            city: answers.city.trim() || null,
            resumeParsed: resume?.parsed ?? null,
            resumeFileName: resume?.fileName ?? null,
          }),
        });
      })();

      // Without a résumé the save lands in under a second, which reads as a
      // flicker. Holding the screen for its full copy cycle gives the hand-off
      // a beat; slower work simply extends it rather than being raced.
      const [res] = await Promise.all([
        work,
        wait(setupLoaderDuration(!!resumeFile)),
      ]);

      if (!res.ok) {
        toast.error("Couldn't save your answers");
        setIsSaving(false);
        return;
      }

      // Deliberately stays true. Marking the user set up re-renders this page,
      // and dropping the loader here would flash an empty screen underneath
      // while the navigation to the app is still in flight.
      updateUser({ isSetup: true });
      router.push("/");
    } catch (error) {
      console.error("Onboarding error:", error);
      toast.error("Something went wrong");
      setIsSaving(false);
    }
  };

  const advance = () => (isLast ? finish() : goTo(step + 1));

  useEffect(() => {
    const onKeyDown = (e) => {
      // Only when nothing is focused. Enter on an option or on Continue is
      // already that control's own click, and handling it here too would
      // advance twice; Enter in the "add your own" field means "add".
      if (e.key !== "Enter" || e.target !== document.body || isSaving) return;
      advance();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, answers, resumeFile, isSaving]);

  if (!mounted || !isAuthenticated) return null;

  // Checked before the isSetup guard, so the hand-off screen survives the
  // re-render that flipping isSetup causes.
  if (isSaving) return <SetupLoader hasResume={!!resumeFile} />;

  if (user?.isSetup) return null;

  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <OnboardingBackdrop />

      <header className="relative z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="h-0.5 w-full bg-muted">
          <motion.div
            className="h-full bg-primary"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>
        <div className="mx-auto flex w-full max-w-xl items-center justify-between px-6 py-3">
          <span className="text-xs font-medium text-muted-foreground">
            Question {step + 1} of {steps.length}
          </span>
          {current.optional && (
            <button
              type="button"
              onClick={advance}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {isLast ? "Skip and finish" : "Skip"}
            </button>
          )}
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-start justify-center px-6 py-10 sm:items-center sm:py-14">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -28 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6"
            >
              <div className="space-y-1.5">
                <h1 className="text-3xl font-bold tracking-tight text-balance">
                  {current.title}
                </h1>
                {current.subtitle && (
                  <p className="text-muted-foreground text-balance">
                    {current.subtitle}
                  </p>
                )}
              </div>

              {current.body}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4 px-6 py-4">
          <p className="hidden text-xs text-muted-foreground sm:block">
            You can change any of this later in Settings.
          </p>

          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
            {step > 0 && (
              <Button variant="ghost" onClick={() => goTo(step - 1)}>
                <ArrowLeft />
                Back
              </Button>
            )}
            <Button onClick={advance} className="min-w-32">
              {isLast ? "Finish" : "Continue"}
              {!isLast && <ArrowRight />}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * The questionnaire itself.
 *
 * Every step is optional — a user who taps Continue six times still lands in
 * the app — so `optional` here only controls whether the Skip affordance shows,
 * and it is hidden on steps the user has already answered.
 */
function buildSteps({
  answers,
  set,
  resumeFile,
  setResumeFile,
  scheduleAdvance,
}) {
  return [
    {
      title: "What roles are you going after?",
      subtitle: `Pick up to ${MAX_ROLES}. This decides who we find for you and how your emails read.`,
      optional: answers.targetRoles.length === 0,
      body: (
        <OptionGrid
          options={ROLE_SUGGESTIONS}
          value={answers.targetRoles}
          onChange={(targetRoles) => set({ targetRoles })}
          multi
          max={MAX_ROLES}
          allowCustom
          customPlaceholder="e.g. Solutions Architect, then press Enter"
        />
      ),
    },
    {
      title: "Where are you in your career?",
      subtitle:
        "A senior pitch reads nothing like a fresher one, so this changes how yours is written.",
      optional: !answers.seniority,
      body: (
        <OptionGrid
          options={SENIORITY}
          value={answers.seniority}
          onChange={(seniority) => {
            set({ seniority });
            if (seniority) scheduleAdvance();
          }}
        />
      ),
    },
    {
      title: "What kind of work are you open to?",
      subtitle: "Pick as many as apply.",
      optional: answers.employmentTypes.length === 0,
      body: (
        <OptionGrid
          options={EMPLOYMENT_TYPES}
          value={answers.employmentTypes}
          onChange={(employmentTypes) => set({ employmentTypes })}
          multi
        />
      ),
    },
    {
      title: "Where do you want to work?",
      optional: answers.workModes.length === 0,
      body: (
        <div className="space-y-6">
          <OptionGrid
            options={WORK_MODES}
            value={answers.workModes}
            onChange={(workModes) => set({ workModes })}
            multi
            columns={3}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={answers.city}
                placeholder="Bengaluru"
                onChange={(e) => set({ city: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={answers.country}
                placeholder="India"
                onChange={(e) => set({ country: e.target.value })}
              />
            </div>
          </div>

          <YesNo
            label="Open to relocating?"
            value={answers.willRelocate}
            onChange={(willRelocate) => set({ willRelocate })}
          />

          <YesNo
            label="Do you need visa sponsorship to work abroad?"
            hint="Only used to skip companies that can't hire you. It never appears in anything we send."
            value={answers.needsSponsorship}
            onChange={(needsSponsorship) => set({ needsSponsorship })}
          />
        </div>
      ),
    },
    {
      title: "How's the search going?",
      subtitle: "Last one about you. It tunes how your first campaign is paced.",
      optional: !answers.urgency && answers.blockers.length === 0,
      body: (
        <div className="space-y-6">
          <OptionGrid
            options={URGENCY}
            value={answers.urgency}
            onChange={(urgency) => set({ urgency })}
          />

          <div className="space-y-3 border-t border-border pt-6">
            <p className="font-medium">
              What&apos;s the hardest part right now?
            </p>
            <OptionGrid
              options={BLOCKERS}
              value={answers.blockers}
              onChange={(blockers) => set({ blockers })}
              multi
              columns={1}
            />
          </div>
        </div>
      ),
    },
    {
      title: "Want us to fill in the rest?",
      subtitle:
        "Optional. Drop your résumé and we'll read your title, experience and skills off it, so you don't have to type them.",
      optional: !resumeFile,
      body: (
        <div className="space-y-3">
          <ResumeUpload file={resumeFile} onSelect={setResumeFile} />
          <p className="text-xs text-muted-foreground">
            We read it once when you finish, then discard the file. Your résumé
            is never stored, and never sent to anyone.
          </p>
        </div>
      ),
    },
  ];
}

function YesNo({ label, hint, value, onChange }) {
  const options = [
    { label: "Yes", answer: true },
    { label: "No", answer: false },
  ];

  return (
    <div className="space-y-2">
      <div>
        <p className="font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex gap-2">
        {options.map((option) => {
          const active = value === option.answer;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={active}
              // Tapping the active choice clears it, so an accidental answer to
              // a question this personal can be taken back.
              onClick={() => onChange(active ? null : option.answer)}
              className={cn(
                "min-w-20 rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                active
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-background hover:border-primary/40 hover:bg-muted/50",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
