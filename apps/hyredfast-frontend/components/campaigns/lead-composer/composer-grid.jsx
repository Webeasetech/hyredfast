"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2Icon } from "mage-icons-react/bulk";
import { cn } from "@/lib/utils";
import { BASE_COLUMNS, STATE_LABELS } from "@/lib/lead-draft";

/**
 * One cell. Commits on blur and Enter, reverts on Escape.
 *
 * A bare input rather than the Input component: that one is form chrome —
 * rounded, shadowed, ring on focus — and a spreadsheet cell wants the opposite.
 * This fills its cell edge to edge, the gridline is its own right border, and
 * focus draws an inset outline the way a sheet marks the active cell.
 *
 * The value is held locally while focused so a debounced save landing
 * mid-keystroke can't yank the text out from under the cursor.
 */
function EditableCell({ value, placeholder, onCommit, onEdit, invalid }) {
  const [draft, setDraft] = useState(value ?? "");
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value ?? "");
  }, [value]);

  return (
    <input
      value={draft}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
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
        invalid && "text-red-700",
      )}
    />
  );
}

export default function ComposerGrid({
  rows,
  columns,
  /** column -> value, rendered read-only. Company and role live here: they are
      the same for every row, so they are shown but not editable per row. */
  fixedValues = {},
  states,
  selected,
  onToggleRow,
  onToggleAll,
  onCellCommit,
  onCellEdit,
  onDeleteRow,
  onPaste,
  /** Called with a fixed column's name when its cell is clicked, so the group
      header's matching field can take focus. The value lives there, not here. */
  onFixedFocus,
}) {
  // Checkbox, row number, one column per field, delete. No gap and no padding:
  // the gridlines are each cell's own border, the way a sheet draws them.
  const gridStyle = {
    gridTemplateColumns: `2rem 2.5rem repeat(${columns.length}, minmax(9rem, 1fr)) 2.25rem`,
  };

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <div className="overflow-x-auto" onPaste={onPaste}>
      <div className="min-w-max border-b border-border">
        {/* Column headers */}
        <div
          className="grid items-center border-b border-border bg-muted"
          style={gridStyle}
        >
          <span className="flex h-8 items-center justify-center border-r border-border">
            <Checkbox
              checked={allSelected || (someSelected ? "indeterminate" : false)}
              onCheckedChange={(next) => onToggleAll(next === true)}
              aria-label={allSelected ? "Deselect all rows" : "Select all rows"}
            />
          </span>
          <span className="flex h-8 items-center justify-center border-r border-border text-xs font-medium text-muted-foreground">
            #
          </span>
          {columns.map((col) => (
            <span
              key={col}
              className="flex h-8 items-center truncate border-r border-border px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              title={col}
            >
              {col}
            </span>
          ))}
          <span className="h-8" />
        </div>

        {/* Rows */}
        {rows.map((row, index) => {
          const state = states[row.id] || "blank";
          const isSelected = selected.has(row.id);

          return (
            <div
              key={row.id}
              title={state === "blank" ? undefined : STATE_LABELS[state]}
              className={cn(
                "grid items-center border-b border-border last:border-b-0",
                // Plain zebra striping — banding helps the eye track across a
                // wide row, and leaves colour free to mean selection.
                index % 2 === 0 ? "bg-white" : "bg-muted/30",
                isSelected && "bg-primary/10",
              )}
              style={gridStyle}
            >
              <span className="flex h-8 items-center justify-center border-r border-border">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleRow(row.id)}
                  aria-label={`Select row ${index + 1}`}
                />
              </span>

              {/* Row header, like a sheet's — reads as a label, not as data. */}
              <span className="flex h-8 items-center justify-center border-r border-border bg-muted/40 text-xs tabular-nums text-muted-foreground">
                {index + 1}
                {/* The tint carries this visually; spell it out for screen readers. */}
                {state !== "blank" && (
                  <span className="sr-only">, {STATE_LABELS[state]}</span>
                )}
              </span>

              {columns.map((col) => {
                // Mirrors the group header, and follows it as it changes.
                if (col in fixedValues) {
                  const shown = fixedValues[col];
                  // Reads as a cell, behaves as a shortcut: clicking where the
                  // value is sends the caret to where it is edited, rather than
                  // leaving a dead cell and no hint of where the value comes from.
                  return (
                    <button
                      key={col}
                      type="button"
                      title={shown || undefined}
                      aria-label={`Edit ${col} for these leads`}
                      onClick={() => onFixedFocus?.(col)}
                      className={cn(
                        "flex h-8 w-full min-w-0 items-center border-r border-border px-2 text-left text-sm",
                        "hover:bg-muted/60 focus:outline-2 focus:-outline-offset-2 focus:outline-primary",
                        shown ? "text-muted-foreground" : "text-muted-foreground/40",
                      )}
                    >
                      <span className="truncate">{shown || `no ${col} yet`}</span>
                    </button>
                  );
                }

                const isBase = BASE_COLUMNS.includes(col);
                const value = isBase ? row[col] : row.personalization?.[col];
                const invalid =
                  col === "email" && ["invalid", "duplicate"].includes(state);

                return (
                  <EditableCell
                    key={col}
                    value={value}
                    placeholder={col === "email" ? "name@company.com" : col}
                    invalid={invalid}
                    onEdit={(v) => onCellEdit?.(row.id, col, v)}
                    onCommit={(v) => onCellCommit(row.id, col, v)}
                  />
                );
              })}

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-full rounded-none text-muted-foreground hover:text-red-600"
                aria-label={`Delete row ${index + 1}`}
                onClick={() => onDeleteRow(row.id)}
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
