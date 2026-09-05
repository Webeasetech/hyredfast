"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { REQUIRED_FIELDS } from "@/lib/lead-draft";
import { cellAddress } from "@/lib/sheet-navigation";
import { MIN_COLUMN_WIDTH } from "@/hooks/use-column-widths";

/**
 * The cells the sheet is built from.
 *
 * All three share one shape — a fixed-height box whose right border is the
 * gridline — so a row lines up whether a cell is typed into, mirrored from the
 * group header, or a heading. Kept apart from the grid so that grid stays a
 * layout: which columns, in which order, in which rows.
 */

/**
 * A cell in an error state: tinted and red-lettered, carrying its reason as a
 * title. No outline of its own — the gridlines are the only borders here, and a
 * box drawn inside one cell reads as a wider column than its neighbours.
 */
const errorClasses = "bg-red-50 text-red-700";

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
 *
 * Arrows move by "smart edges": up and down always change row, since a caret
 * cannot go up inside a single line anyway, while left and right move the caret
 * until it reaches the end of the text and only then step to the next cell. No
 * mode to notice, and editing a typo mid-word still works the way typing does
 * everywhere else.
 */
export function EditableCell({
  rowId,
  column,
  value,
  placeholder,
  onCommit,
  onEdit,
  onMove,
  onActivate,
  error,
}) {
  const [draft, setDraft] = useState(value ?? "");
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value ?? "");
  }, [value]);

  const handleKeyDown = (e) => {
    const input = e.currentTarget;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd =
      input.selectionStart === input.value.length &&
      input.selectionEnd === input.value.length;

    // A step out of this cell blurs it, and blur is what commits — so no
    // keystroke here has to save anything itself.
    const step = (options) => {
      if (onMove?.(options)) e.preventDefault();
    };

    switch (e.key) {
      case "ArrowDown":
        step({ rowStep: 1 });
        break;
      case "ArrowUp":
        step({ rowStep: -1 });
        break;
      case "ArrowRight":
        if (atEnd) step({ columnStep: 1 });
        break;
      case "ArrowLeft":
        if (atStart) step({ columnStep: -1 });
        break;
      case "Tab":
        step({ columnStep: e.shiftKey ? -1 : 1 });
        break;
      case "Enter":
        // Falls back to a plain blur on the last row, which still commits.
        if (!onMove?.({ rowStep: 1 })) input.blur();
        e.preventDefault();
        break;
      case "Escape":
        setDraft(value ?? "");
        focused.current = false;
        input.blur();
        break;
      default:
        break;
    }
  };

  return (
    <input
      data-cell={cellAddress(rowId, column)}
      value={draft}
      placeholder={placeholder}
      title={error || undefined}
      aria-invalid={error ? true : undefined}
      aria-errormessage={error || undefined}
      onFocus={() => {
        focused.current = true;
        onActivate?.(rowId, column);
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        onEdit?.(e.target.value);
      }}
      onBlur={() => {
        focused.current = false;
        onCommit(draft);
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        "h-8 w-full min-w-0 border-r border-border bg-transparent px-2 text-sm",
        "outline-none placeholder:text-muted-foreground/50",
        // Inset, so the active cell's outline never clips against a neighbour.
        "focus:bg-white focus:outline-2 focus:-outline-offset-2 focus:outline-primary",
        error && `${errorClasses} placeholder:text-red-400`,
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
      // Out of the tab order: Tab walks the cells a user types into, and these
      // two are not among them.
      tabIndex={-1}
      title={error || value || undefined}
      aria-label={
        error
          ? `${column} for these leads: ${error}`
          : `Edit ${column} for these leads`
      }
      onClick={() => onFocusField?.(column)}
      className={cn(
        "flex h-8 w-full min-w-0 items-center border-r border-border px-2 text-left text-sm",
        "hover:bg-muted/60 focus:outline-2 focus:-outline-offset-2 focus:outline-primary",
        error
          ? errorClasses
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
 * A column heading, with the drag handle that sets the column's width.
 *
 * The four fields a lead cannot go out without are starred, so the requirement
 * is visible before a publish reports it. The heading of the column holding the
 * active cell is tinted, which is how a spreadsheet answers "which column am I
 * in" on a row too wide to take in at once.
 */
export function HeaderCell({ column, width, active, onResize }) {
  const drag = useRef(null);

  // Bound to the window, not the handle: a pointer moving faster than React
  // re-renders leaves the handle behind, and the drag has to keep tracking.
  useEffect(() => {
    const onMove = (e) => {
      if (!drag.current) return;
      onResize(column, drag.current.width + (e.clientX - drag.current.x));
    };
    const onUp = () => {
      drag.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [column, onResize]);

  const required = REQUIRED_FIELDS.includes(column);

  return (
    <span
      className={cn(
        "group/header relative flex h-8 items-center gap-0.5 truncate border-r border-border px-2",
        "text-xs font-medium uppercase tracking-wide text-muted-foreground",
        active && "bg-primary/10 text-foreground",
      )}
      title={required ? `${column} (required)` : column}
    >
      <span className="truncate">{column}</span>
      {required && (
        <span aria-hidden="true" className="text-red-500">
          *
        </span>
      )}
      {required && <span className="sr-only">(required)</span>}

      {/* Sits over the gridline itself, so the thing you grab is the line you
          are moving. Widened invisibly, because a 1px target is a fight. */}
      <span
        role="separator"
        aria-label={`Resize ${column} column`}
        aria-orientation="vertical"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, width };
          document.body.style.cursor = "col-resize";
          // Otherwise the drag paints a text selection across the header row.
          document.body.style.userSelect = "none";
        }}
        onDoubleClick={() => onResize(column, MIN_COLUMN_WIDTH)}
        className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize touch-none hover:bg-primary/40 group-hover/header:bg-border"
      />
    </span>
  );
}
