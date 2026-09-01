"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2Icon } from "mage-icons-react/bulk";
import { cn } from "@/lib/utils";
import { BASE_COLUMNS, STATE_LABELS } from "@/lib/lead-draft";
import {
  EditableCell,
  FixedCell,
  HeaderCell,
} from "@/components/campaigns/lead-composer/composer-cells";

/**
 * The grid for one group's leads.
 *
 * Layout only: which columns, in which order, in which rows. What a cell does
 * lives in `composer-cells`, and what counts as an error lives in
 * `lib/lead-draft` — this just places them.
 */
export default function ComposerGrid({
  rows,
  columns,
  /** column -> value, rendered read-only. Company and role live here: they are
      the same for every row, so they are shown but not editable per row. */
  fixedValues = {},
  states,
  /** rowId -> { column: message }. Empty until a submit has been attempted:
      typing a lead in should not be narrated as a series of failures. */
  errors = {},
  selected,
  onToggleRow,
  onToggleAll,
  onCellCommit,
  onCellEdit,
  onDeleteRow,
  onPaste,
  /** Called with a fixed column's name when its cell is clicked, so the group
      header's matching field can take focus. The value lives there, not here. */
  onFocusField,
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
            <HeaderCell key={col} column={col} />
          ))}
          <span className="h-8" />
        </div>

        {/* Rows */}
        {rows.map((row, index) => {
          const state = states[row.id] || "blank";
          const isSelected = selected.has(row.id);
          const cellErrors = errors[row.id] || {};

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

              {columns.map((col) =>
                // Mirrors the group header, and follows it as it changes.
                col in fixedValues ? (
                  <FixedCell
                    key={col}
                    column={col}
                    value={fixedValues[col]}
                    error={cellErrors[col]}
                    onFocusField={onFocusField}
                  />
                ) : (
                  <EditableCell
                    key={col}
                    value={
                      BASE_COLUMNS.includes(col)
                        ? row[col]
                        : row.personalization?.[col]
                    }
                    placeholder={col === "email" ? "name@company.com" : col}
                    error={cellErrors[col]}
                    onEdit={(v) => onCellEdit?.(row.id, col, v)}
                    onCommit={(v) => onCellCommit(row.id, col, v)}
                  />
                ),
              )}

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
