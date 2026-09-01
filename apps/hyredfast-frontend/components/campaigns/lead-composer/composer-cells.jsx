"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { REQUIRED_FIELDS } from "@/lib/lead-draft";

/**
 * The cells the composer grid is built from.
 *
 * All three share one shape — a fixed-height box whose right border is the
 * gridline — so a row lines up whether a cell is typed into, mirrored from the
 * group header, or a heading. Kept apart from the grid so that grid stays a
 * layout: which columns, in which order, in which rows.
 */

/** A cell in an error state: outlined red, tinted, and carrying its reason. */
const errorClasses = "bg-red-50 outline-1 -outline-offset-1 outline-red-500";

/**
 * One editable cell. Commits on blur and Enter, reverts on Escape.
 *
 * A bare input rather than the Input component: that one is form chrome —
 * rounded, shadowed, ring on focus — and a spreadsheet cell wants the opposite.
 * This fills its cell edge to edge, the gridline is its own right border, and
 * focus draws an inset outline the way a sheet marks the active cell.
 *
 * The value is held locally while focused so a debounced save landing
 * mid-keystroke can't yank the text out from under the cursor.
 */
export function EditableCell({ value, placeholder, onCommit, onEdit, error }) {
  const [draft, setDraft] = useState(value ?? "");
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value ?? "");
  }, [value]);

  return (
    <input
      value={draft}
      placeholder={placeholder}
      title={error || undefined}
      aria-invalid={error ? true : undefined}
      aria-errormessage={error || undefined}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        onEdit?.(e.target.value);
      }}
      onBlur={() => {
        focused.current = false;
        onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value ?? "");
          focused.current = false;
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "h-8 w-full min-w-0 border-r border-border bg-transparent px-2 text-sm",
        "outline-none placeholder:text-muted-foreground/50",
        // Inset, so the active cell's outline never clips against a neighbour.
        "focus:bg-white focus:outline-2 focus:-outline-offset-2 focus:outline-primary",
        error && `${errorClasses} text-red-900 placeholder:text-red-400`,
      )}
    />
  );
}

/**
 * A cell whose value belongs to the group rather than the row — company and
 * role, mirrored from the header above.
 *
 * Read-only, because editing it here would change one lead's answer to a
 * question the whole group shares. Clicking it is still the obvious reach for
 * that value, so it sends the caret to the header field that owns it rather
 * than being a dead cell with no hint of where the value comes from.
 */
export function FixedCell({ column, value, error, onFocusField }) {
  return (
    <button
      type="button"
      title={error || value || undefined}
      aria-invalid={error ? true : undefined}
      aria-label={`Edit ${column} for these leads`}
      onClick={() => onFocusField?.(column)}
      className={cn(
        "flex h-8 w-full min-w-0 items-center border-r border-border px-2 text-left text-sm",
        "hover:bg-muted/60 focus:outline-2 focus:-outline-offset-2 focus:outline-primary",
        error
          ? `${errorClasses} text-red-700`
          : value
            ? "text-muted-foreground"
            : "text-muted-foreground/40",
      )}
    >
      <span className="truncate">{value || `no ${column} yet`}</span>
    </button>
  );
}

/**
 * A column heading. The four fields a lead cannot go out without are starred,
 * so the requirement is visible before a submit reports it.
 */
export function HeaderCell({ column }) {
  const required = REQUIRED_FIELDS.includes(column);

  return (
    <span
      className="flex h-8 items-center gap-0.5 truncate border-r border-border px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
      title={required ? `${column} (required)` : column}
    >
      <span className="truncate">{column}</span>
      {required && (
        <span aria-hidden="true" className="text-red-500">
          *
        </span>
      )}
      {required && <span className="sr-only">(required)</span>}
    </span>
  );
}
