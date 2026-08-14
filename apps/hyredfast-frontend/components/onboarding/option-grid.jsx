"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * The one control the whole questionnaire is built from: a grid of tappable
 * options, single or multi select.
 *
 * `allowCustom` adds an inline "add your own" field whose entries join the grid
 * already selected — used only where the preset list genuinely can't be
 * complete (job titles), not everywhere.
 *
 * Options may be plain strings or `{ value, label, hint }`.
 */
export function OptionGrid({
  options,
  value,
  onChange,
  multi = false,
  columns = 2,
  allowCustom = false,
  customPlaceholder = "Type and press Enter",
  max,
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const normalized = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );

  const selected = multi ? (value ?? []) : value ? [value] : [];
  const isSelected = (v) => selected.includes(v);

  // Custom entries live only in `value`, so anything selected that isn't a
  // preset is one the user typed. Rendering them here keeps them removable.
  const presetValues = new Set(normalized.map((o) => o.value));
  const custom = selected
    .filter((v) => !presetValues.has(v))
    .map((v) => ({ value: v, label: v, custom: true }));

  const atMax = multi && max != null && selected.length >= max;

  const toggle = (v) => {
    if (!multi) {
      onChange(value === v ? null : v);
      return;
    }
    if (isSelected(v)) {
      onChange(selected.filter((s) => s !== v));
    } else if (!atMax) {
      onChange([...selected, v]);
    }
  };

  const commitDraft = () => {
    const entry = draft.trim();
    if (!entry) return;
    // Case-insensitive match against a preset selects that one instead of
    // creating a near-duplicate ("devops engineer" vs "DevOps Engineer").
    const preset = normalized.find(
      (o) => o.label.toLowerCase() === entry.toLowerCase(),
    );
    const next = preset ? preset.value : entry;
    if (!isSelected(next) && !atMax) {
      onChange(multi ? [...selected, next] : next);
    }
    setDraft("");
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "grid gap-2",
          columns === 1 && "grid-cols-1",
          columns === 2 && "grid-cols-1 sm:grid-cols-2",
          columns === 3 && "grid-cols-2 sm:grid-cols-3",
        )}
      >
        {[...normalized, ...custom].map((option) => {
          const active = isSelected(option.value);
          const disabled = !active && atMax;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              disabled={disabled}
              aria-pressed={active}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                active
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:border-primary/40 hover:bg-muted/50",
                disabled && "cursor-not-allowed opacity-40 hover:border-border",
              )}
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center border transition-colors",
                  multi ? "rounded-sm" : "rounded-full",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background",
                )}
              >
                {active && <Check className="size-3" strokeWidth={3} />}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate font-medium",
                    active ? "text-primary" : "text-foreground",
                  )}
                >
                  {option.label}
                </span>
                {option.hint && (
                  <span className="block text-xs text-muted-foreground">
                    {option.hint}
                  </span>
                )}
              </span>

              {option.custom && (
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${option.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(
                      multi ? selected.filter((s) => s !== option.value) : null,
                    );
                  }}
                  className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {allowCustom &&
        (adding ? (
          <Input
            autoFocus
            value={draft}
            placeholder={customPlaceholder}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              commitDraft();
              setAdding(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                // Stays open so several can be added in a row.
                commitDraft();
              }
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={atMax}
            className={cn(
              "inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80",
              atMax && "cursor-not-allowed opacity-40",
            )}
          >
            <Plus className="size-3.5" />
            Add your own
          </button>
        ))}

      {atMax && (
        <p className="text-xs text-muted-foreground">
          That&apos;s {max}. Deselect one to swap it out.
        </p>
      )}
    </div>
  );
}
