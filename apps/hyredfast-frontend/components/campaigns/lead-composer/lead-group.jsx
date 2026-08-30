"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import ComposerGrid from "@/components/campaigns/lead-composer/composer-grid";
import { isGroupComplete } from "@/lib/lead-draft";

/**
 * A blank to fill in, sitting inside a sentence.
 *
 * The app's outlined Input, sized down and set to hug its text: `size` gives it
 * an intrinsic width (supported everywhere, no measuring span) and `w-auto`
 * lets that width win, so the sentence still reads as a sentence.
 *
 * The value is held locally while focused so a save landing mid-keystroke can't
 * move the cursor.
 */
function InlineField({ value, placeholder, label, onCommit }) {
  const [draft, setDraft] = useState(value ?? "");
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value ?? "");
  }, [value]);

  return (
    <Input
      value={draft}
      placeholder={placeholder}
      aria-label={label}
      // +1 so the caret has somewhere to sit past the last character.
      size={Math.max(placeholder.length, draft.length) + 1}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => setDraft(e.target.value)}
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
        "h-8 w-auto max-w-full bg-white px-2 py-1 text-sm font-medium",
        "placeholder:font-normal",
        // An unfilled blank is outlined amber, so the gap in the sentence shows
        // before anyone reads the warning underneath it.
        !draft.trim() && "border-amber-400",
      )}
    />
  );
}

/**
 * One company/role pairing and its leads.
 *
 * Presented as an accordion item but never collapses: the leads are the point
 * of the screen, and hiding them behind a toggle would put a click between the
 * user and the thing they came to do. The header is the affordance — it says
 * who these leads are for, once, instead of every row repeating it.
 */
export default function LeadGroup({
  group,
  color,
  columns,
  states,
  selected,
  onToggleRow,
  onToggleAll,
  onCellCommit,
  onCellEdit,
  onDeleteRow,
  onPaste,
  onFieldCommit,
}) {
  const complete = isGroupComplete(group);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border bg-white",
        // Incomplete outranks the group's own colour — it is the one thing here
        // that needs acting on.
        complete ? color.border : "border-amber-300",
      )}
    >
      {/* Header — one sentence, fixed for every lead below it */}
      <div
        className={cn(
          "flex items-center gap-3 border-b px-3 py-2",
          color.header,
          color.border,
        )}
      >
        <p
          className={cn(
            "flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm",
            color.muted,
          )}
        >
          <span>I&apos;m looking to apply at</span>
          <InlineField
            label="Company"
            value={group.company}
            placeholder="company"
            onCommit={(v) => onFieldCommit(group, "company", v)}
          />
          <span>as</span>
          <InlineField
            label="Role"
            value={group.role}
            placeholder="role"
            onCommit={(v) => onFieldCommit(group, "role", v)}
          />
        </p>

        <div className="flex shrink-0 items-center gap-2">
          {/* No delete here on purpose: removing a whole group is selecting
              its rows with the header checkbox and using the bulk action, so
              there is one way to delete rather than two. */}
          <span className={cn("text-xs", color.muted)}>
            {group.rows.length} lead{group.rows.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {!complete && (
        <p className="border-b border-border bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          Add a company and a role — these leads can&apos;t be added to the
          campaign without them.
        </p>
      )}

      {/* Content — the same grid used everywhere, minus the header's fields */}
      <ComposerGrid
        rows={group.rows}
        columns={columns}
        // Read straight off the group, so the columns follow the sentence above
        // them the moment either field is committed.
        fixedValues={{ company: group.company, role: group.role }}
        states={states}
        selected={selected}
        onToggleRow={onToggleRow}
        onToggleAll={(checked) => onToggleAll(group, checked)}
        onCellCommit={onCellCommit}
        onCellEdit={onCellEdit}
        onDeleteRow={onDeleteRow}
        onPaste={(e) => onPaste(group, e)}
      />
    </section>
  );
}
