/**
 * Faint dot grid behind the questionnaire. Purely decorative, and masked so it
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
