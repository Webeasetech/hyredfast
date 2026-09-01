"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { PlusIcon } from "mage-icons-react/stroke";
import { Button } from "@/components/ui/button";
import { PanelSkeleton } from "@/components/skeletons";
import LeadGroup from "@/components/campaigns/lead-composer/lead-group";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import fetcher from "@/lib/fetcher";
import { post, remove, patch } from "@/lib/apis";
import instance from "@/lib/axios";
import { cn } from "@/lib/utils";
import { groupColor } from "@/lib/group-colors";
import {
  BASE_COLUMNS,
  classifyRow,
  groupRows,
  isGroupComplete,
  isRowFilled,
  normaliseEmail,
  seedColumns,
  displayColumns,
  editableColumns,
} from "@/lib/lead-draft";

const SAVE_LABELS = {
  idle: "All changes saved",
  saving: "Saving…",
  saved: "All changes saved",
  error: "Couldn't save — retrying on next edit",
};

/** Split a pasted spreadsheet block. Clipboard data from Sheets/Excel is TSV. */
function parseClipboardBlock(text, columns) {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim());
  if (!lines.length) return [];

  const cells = lines.map((line) => line.split("\t"));

  // Drop a header row if the pasted first line just repeats the column names.
  const first = cells[0].map((c) => c.trim().toLowerCase());
  const looksLikeHeader = first.some((c) => columns.includes(c));
  const body = looksLikeHeader ? cells.slice(1) : cells;

  return body.map((cell) => {
    const row = { name: "", email: "", personalization: {} };
    columns.forEach((col, i) => {
      const value = (cell[i] ?? "").trim();
      if (BASE_COLUMNS.includes(col)) row[col] = value;
      else row.personalization[col] = value;
    });
    return row;
  });
}

/**
 * The lead composer.
 *
 * Leads are written per company and role rather than one flat list: those two
 * are the same for every lead in a batch, so they are stated once in a group
 * header instead of being retyped on every row.
 *
 * Everything typed here is written to a draft as it goes, so closing this —
 * deliberately or by accident — costs nothing. That is the whole point of the
 * screen, which is why nothing prompts before it closes.
 */
export default function LeadComposer({ campaignId, onCommitted }) {
  const [rows, setRows] = useState([]);
  const [draftId, setDraftId] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  const { data: draft, isLoading } = useSWR(
    campaignId ? `/api/lead-drafts?campaign=${campaignId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  // The grid asks for exactly what the emails will need: name, email, and every
  // variable the campaign's pitches reference. Read live rather than stored, so
  // editing a template updates the grid instead of leaving it asking for fields
  // the emails no longer use. Same derivation the add-lead dialog uses.
  const { data: pitchesData } = useSWR(
    campaignId ? `/api/pitches?campaign=${campaignId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const columns = useMemo(() => seedColumns(pitchesData?.items), [pitchesData]);
  // Company and role are shown as read-only columns, mirroring the header.
  const gridColumns = useMemo(() => displayColumns(columns), [columns]);
  // ...but a pasted block maps onto the columns a user can actually fill.
  const pasteColumns = useMemo(() => editableColumns(columns), [columns]);

  // Existing contacts seed the duplicate check, so the grid flags someone the
  // campaign already holds — not just repeats within the draft.
  const { data: contacts } = useSWR(
    campaignId ? `/api/contacts?campaign=${campaignId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (!draft) return;
    setDraftId(draft.id);
    setRows(draft.rows || []);
  }, [draft]);

  // Drop ids for rows that no longer exist, so a stale selection can never
  // target a deleted row or inflate the "N selected" count.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set(rows.map((r) => r.id));
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  const saveRow = useCallback(
    (rowId, payload) =>
      patch(`/api/lead-drafts/${draftId}/rows/${rowId}`, { arg: payload }),
    [draftId],
  );
  const { status: saveStatus, queue, flush, cancel } =
    useDraftAutosave(saveRow);

  // Closing the dialog unmounts this, and a debounce timer does not survive
  // that — so land whatever is queued on the way out.
  useEffect(() => () => flush(), [flush]);

  const groups = useMemo(() => groupRows(rows), [rows]);

  const existingEmails = useMemo(
    () =>
      new Set(
        (contacts || []).map((c) => normaliseEmail(c.email)).filter(Boolean),
      ),
    [contacts],
  );

  // Walked across every group, not per group: two companies can't both claim
  // the same address, and a duplicate marks the second occurrence, not both.
  const { states, readyCount } = useMemo(() => {
    const seen = new Set(existingEmails);
    const result = {};
    let ready = 0;
    for (const group of groups) {
      for (const row of group.rows) {
        const state = classifyRow(row, { columns, seen });
        result[row.id] = state;
        if (state === "ready") {
          seen.add(normaliseEmail(row.email));
          ready += 1;
        }
      }
    }
    return { states: result, readyCount: ready };
  }, [groups, columns, existingEmails]);

  const applyCell = useCallback((rowId, col, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return BASE_COLUMNS.includes(col)
          ? { ...r, [col]: value }
          : {
              ...r,
              personalization: { ...(r.personalization || {}), [col]: value },
            };
      }),
    );
  }, []);

  const handleCellCommit = useCallback(
    (rowId, col, value) => {
      setRows((prev) => {
        const next = prev.map((r) => {
          if (r.id !== rowId) return r;
          return BASE_COLUMNS.includes(col)
            ? { ...r, [col]: value }
            : {
                ...r,
                personalization: { ...(r.personalization || {}), [col]: value },
              };
        });
        const row = next.find((r) => r.id === rowId);
        if (row) {
          queue(rowId, {
            name: row.name ?? "",
            email: row.email ?? "",
            personalization: row.personalization ?? {},
          });
        }
        return next;
      });
    },
    [queue],
  );

  /** Rows are created carrying their group's company and role. */
  const addRows = useCallback(
    async (group, newRows) => {
      if (!draftId) return;
      const stamped = newRows.map((r) => ({
        ...r,
        personalization: {
          ...(r.personalization || {}),
          company: group?.company ?? "",
          role: group?.role ?? "",
        },
      }));

      try {
        const res = await post(`/api/lead-drafts/${draftId}/rows`, {
          arg: { rows: stamped },
        });
        // Take the server's ordering but keep the local copy of any row we
        // already had — a row can be appended while the user is still typing in
        // the one above it, and that keystroke may not have been saved yet.
        setRows((prev) => {
          const local = new Map(prev.map((r) => [r.id, r]));
          return res.rows.map((r) => local.get(r.id) ?? r);
        });
        return res.rows;
      } catch {
        toast.error("Couldn't add rows");
      }
    },
    [draftId],
  );

  const blankRow = () => ({ name: "", email: "", personalization: {} });

  const handleAddGroup = useCallback(() => {
    // A group is only its company and role, so an unnamed one is
    // indistinguishable from another unnamed one. Name the first before making
    // a second.
    if (groups.some((g) => !g.company && !g.role)) {
      toast("Finish the empty job application first", {
        description: "Give it a company and role, then add another.",
      });
      return;
    }
    addRows({ company: "", role: "" }, [blankRow()]);
  }, [groups, addRows]);

  /**
   * Company and role are stored on every row in the group, so editing the
   * header rewrites them all. Pushed through the same autosave queue as cell
   * edits, so ordering and the saved indicator stay consistent.
   */
  const handleFieldCommit = useCallback(
    (group, field, value) => {
      const next = value.trim();
      if ((group[field] ?? "") === next) return;

      const ids = new Set(group.rows.map((r) => r.id));
      setRows((prev) => {
        const updated = prev.map((r) =>
          ids.has(r.id)
            ? {
                ...r,
                personalization: { ...(r.personalization || {}), [field]: next },
              }
            : r,
        );
        for (const row of updated) {
          if (!ids.has(row.id)) continue;
          queue(row.id, {
            name: row.name ?? "",
            email: row.email ?? "",
            personalization: row.personalization ?? {},
          });
        }
        return updated;
      });
    },
    [queue],
  );

  const deleteRowIds = useCallback(
    async (ids) => {
      if (!ids.length) return;
      // These rows are about to stop existing, so drop any queued write for
      // them first — it would land on a missing row and report a failure the
      // user cannot act on. Cancelled per row, never wholesale: the rows
      // staying put may have unsaved edits of their own.
      ids.forEach(cancel);
      const gone = new Set(ids);
      setRows((prev) => prev.filter((r) => !gone.has(r.id)));
      setSelected((prev) => new Set([...prev].filter((id) => !gone.has(id))));

      try {
        await remove(`/api/lead-drafts/${draftId}/rows`, {
          arg: { data: { ids } },
        });
      } catch {
        toast.error("Couldn't delete those rows");
      }
    },
    [draftId, cancel],
  );

  const handleDeleteRow = useCallback(
    (rowId) => deleteRowIds([rowId]),
    [deleteRowIds],
  );

  const handleDeleteSelected = useCallback(async () => {
    const ids = [...selected];
    if (!ids.length) return;
    await deleteRowIds(ids);
    toast.success(`Deleted ${ids.length} row${ids.length === 1 ? "" : "s"}`);
  }, [selected, deleteRowIds]);

  const toggleRow = useCallback((rowId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  /** Select-all is per group — the checkbox lives in that group's header row. */
  const toggleAllInGroup = useCallback((group, checked) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const row of group.rows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }, []);

  const handlePaste = useCallback(
    (group, e) => {
      const text = e.clipboardData?.getData("text/plain") || "";
      // A single value belongs in the focused cell; only a block becomes rows.
      if (!text.includes("\t") && !text.trim().includes("\n")) return;

      e.preventDefault();
      const parsed = parseClipboardBlock(text, pasteColumns);
      if (!parsed.length) return;

      addRows(group, parsed).then((next) => {
        if (next) {
          toast.success(
            `Added ${parsed.length} row${parsed.length === 1 ? "" : "s"} from your clipboard`,
          );
        }
      });
    },
    [pasteColumns, addRows],
  );

  const handleCommit = useCallback(async () => {
    flush(); // land in-flight edits before the server reads the rows
    setCommitting(true);
    try {
      const { committed, skipped } = await instance.post(
        `/api/lead-drafts/${draftId}/commit`,
      );

      if (committed === 0) {
        toast.error("Nothing to add yet", {
          description: "Fill in an email for at least one row.",
        });
        return;
      }

      toast.success(
        `Added ${committed} lead${committed === 1 ? "" : "s"} to the campaign`,
      );
      if (skipped?.length) {
        toast(
          `${skipped.length} row${skipped.length === 1 ? "" : "s"} left in the draft`,
          { description: "They still need fixing — nothing was discarded." },
        );
      }
      onCommitted?.({ committed, skipped });
    } catch {
      toast.error("Couldn't add these leads");
    } finally {
      setCommitting(false);
    }
  }, [draftId, flush, onCommitted]);

  // A group grows an empty row at the bottom the way a spreadsheet does: finish
  // the last row and another appears beneath it. Covers pasting too, so there is
  // always somewhere to carry on typing.
  //
  // "Finish" means the four fields that make a lead a lead: a name, an email,
  // and the group's company and role. Offering the next row before then invites
  // a screen of half-filled leads, none of which can be committed.
  const reshaping = useRef(false);
  const appendBudget = useRef(0);
  useEffect(() => {
    if (!draftId || isLoading || reshaping.current) return;

    const needsRow = groups.find(
      (g) =>
        g.rows.length === 0 ||
        (isGroupComplete(g) && isRowFilled(g.rows[g.rows.length - 1])),
    );
    if (!needsRow) {
      appendBudget.current = 0; // settled — restore the allowance
      return;
    }

    // This effect writes rows and then re-runs on its own result, so a wrong
    // blankness test here means unbounded inserts rather than a stuck UI. The
    // budget bounds the damage instead of trusting the condition to be right.
    if (appendBudget.current >= 25) {
      console.error(
        "[composer] trailing-row append did not settle; stopped to avoid a write loop",
      );
      return;
    }
    appendBudget.current += 1;

    reshaping.current = true;
    Promise.resolve(addRows(needsRow, [blankRow()])).finally(() => {
      reshaping.current = false;
    });
  }, [groups, columns, draftId, isLoading, addRows]);

  if (isLoading) {
    return (
      <div className="p-6">
        <PanelSkeleton lines={6} />
      </div>
    );
  }

  const templateColumns = pasteColumns.filter(
    (c) => !BASE_COLUMNS.includes(c),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar. Height is reserved rather than derived from its contents: the
          bulk-delete button only exists while rows are selected, and letting it
          size the bar makes everything below it jump on every select. */}
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-1.5 md:px-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">
            {selected.size > 0
              ? `${selected.size} selected`
              : `${groups.length} compan${groups.length === 1 ? "y" : "ies"}`}
          </span>
          <span
            className={cn(
              "text-xs",
              saveStatus === "error" ? "text-red-600" : "text-muted-foreground",
            )}
            role="status"
            aria-live="polite"
          >
            {SAVE_LABELS[saveStatus]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Only appears with a selection — deselecting is the header
              checkbox's job, so there is no separate way out of this state. */}
          {selected.size > 0 && (
            <Button variant="outline" size="sm" onClick={handleDeleteSelected}>
              Delete {selected.size}
            </Button>
          )}
        </div>
      </div>

      {/* Groups */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4 md:p-6">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-white py-16 text-center">
            <p className="text-sm font-medium">No leads yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Leads are grouped by the job you&apos;re applying for, so the
              company and role are entered once for all of them.
            </p>
            <Button className="mt-1" onClick={handleAddGroup}>
              <PlusIcon className="mr-1.5 h-4 w-4" />
              Add a job application
            </Button>
          </div>
        ) : (
          <>
            {groups.map((group, index) => (
              <LeadGroup
                // Keyed by a row id, not by group.key: the key is derived from
                // company and role, so keying on it remounts the whole card the
                // moment either is committed — taking focus with it, right as
                // the user tabs from Company to Role.
                key={group.rows[0]?.id ?? group.key}
                group={group}
                color={groupColor(index)}
                columns={gridColumns}
                states={states}
                selected={selected}
                onToggleRow={toggleRow}
                onToggleAll={toggleAllInGroup}
                onCellEdit={applyCell}
                onCellCommit={handleCellCommit}
                onDeleteRow={handleDeleteRow}
                onPaste={handlePaste}
                onFieldCommit={handleFieldCommit}
              />
            ))}

            <div className="flex justify-center pt-1">
              <Button variant="outline" onClick={handleAddGroup}>
                <PlusIcon className="mr-1.5 h-4 w-4" />
                Add another job application
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3 md:px-6">
        <div className="text-sm text-muted-foreground">
          <p>
            Type in the last row and another appears. Paste a block of cells
            from a spreadsheet to fill several at once.
          </p>
          {templateColumns.length > 0 && (
            <p className="mt-0.5">
              {templateColumns.join(", ")}{" "}
              {templateColumns.length === 1 ? "comes" : "come"} from the
              variables your emails use.
            </p>
          )}
        </div>

        <Button
          size="lg"
          onClick={handleCommit}
          disabled={readyCount === 0 || committing}
        >
          {committing
            ? "Adding…"
            : `Add ${readyCount} lead${readyCount === 1 ? "" : "s"} to campaign`}
        </Button>
      </div>
    </div>
  );
}
