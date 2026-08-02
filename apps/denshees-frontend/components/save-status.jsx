import { CheckIcon, ReloadIcon } from "mage-icons-react/stroke";

import { cn } from "@/lib/utils";

/**
 * The feedback that replaces a save button once a form autosaves. Reserves its
 * own height so the surrounding layout doesn't jump as the status changes.
 */
export function SaveStatus({ status, className }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex h-5 items-center gap-1.5 text-xs transition-opacity",
        status === "idle" ? "opacity-0" : "opacity-100",
        status === "error" ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      {status === "saving" && (
        <>
          <ReloadIcon className="size-3 animate-spin" />
          Saving…
        </>
      )}
      {status === "saved" && (
        <>
          <CheckIcon className="size-3" />
          Saved
        </>
      )}
      {status === "error" && "Couldn't save"}
    </span>
  );
}
