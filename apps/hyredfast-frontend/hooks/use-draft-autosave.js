"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const DEBOUNCE_MS = 500;

/**
 * Per-row autosave for the lead composer.
 *
 * The sibling of `useAutosave`, which owns a single payload — a grid needs many
 * rows saving independently, so this keeps one debounce timer and one sequence
 * token per row id. Same status vocabulary, same last-write-wins rule (a draft
 * has exactly one editor, so a newer save for a row simply supersedes an older
 * one).
 *
 * Saves are debounced while typing and flushed on blur, because the status line
 * is the only reason a user will trust closing the tab — a save that lands a
 * half-second after they look away is not reassuring.
 *
 * @param {(rowId: string, payload: any) => Promise<any>} saveFn
 */
export function useDraftAutosave(saveFn) {
  const [status, setStatus] = useState("idle");

  const lastSaved = useRef(new Map()); // rowId -> last serialised payload
  const timers = useRef(new Map()); // rowId -> timeout
  const pending = useRef(new Map()); // rowId -> payload awaiting its timer
  const tokens = useRef(new Map()); // rowId -> latest sequence number
  const inFlight = useRef(0);
  const savedTimer = useRef(null);

  const settle = useCallback(() => {
    if (inFlight.current > 0) return;
    setStatus("saved");
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setStatus("idle"), 2000);
  }, []);

  const send = useCallback(
    async (rowId, payload) => {
      const token = (tokens.current.get(rowId) ?? 0) + 1;
      tokens.current.set(rowId, token);

      inFlight.current += 1;
      setStatus("saving");

      let failed = false;
      try {
        await saveFn(rowId, payload);
      } catch (error) {
        failed = true;
      } finally {
        // Decremented before anything reads it: settle() bails while requests
        // are outstanding, and counting this one as outstanding after it has
        // finished leaves the status stuck on "Saving…" forever.
        inFlight.current -= 1;
      }

      // A row deleted or superseded while its save was in flight fails by
      // design; reporting that tells the user their work is at risk when it
      // is not.
      if (token !== tokens.current.get(rowId)) return;

      if (failed) {
        // Let the next attempt through even though the payload is unchanged.
        lastSaved.current.delete(rowId);
        setStatus("error");
        toast.error("Couldn't save your changes", {
          description: "Your edits are still on screen. Retrying on next edit.",
        });
        return;
      }

      lastSaved.current.set(rowId, JSON.stringify(payload));
      settle();
    },
    [saveFn, settle],
  );

  /** Queue a debounced save for one row. */
  const queue = useCallback(
    (rowId, payload) => {
      // Every cell commits on blur, so tabbing across a row it did not change
      // would otherwise write it once per cell.
      if (lastSaved.current.get(rowId) === JSON.stringify(payload)) return;

      pending.current.set(rowId, payload);
      clearTimeout(timers.current.get(rowId));
      timers.current.set(
        rowId,
        setTimeout(() => {
          timers.current.delete(rowId);
          const next = pending.current.get(rowId);
          pending.current.delete(rowId);
          if (next) send(rowId, next);
        }, DEBOUNCE_MS),
      );
    },
    [send],
  );

  /** Write everything queued right now — used on blur and before navigating. */
  const flush = useCallback(() => {
    for (const [rowId, timer] of timers.current.entries()) {
      clearTimeout(timer);
      const payload = pending.current.get(rowId);
      pending.current.delete(rowId);
      if (payload) send(rowId, payload);
    }
    timers.current.clear();
  }, [send]);

  /** Drop a row's queued write — it is being deleted, so saving it would 404. */
  const cancel = useCallback((rowId) => {
    clearTimeout(timers.current.get(rowId));
    timers.current.delete(rowId);
    pending.current.delete(rowId);
    tokens.current.set(rowId, (tokens.current.get(rowId) ?? 0) + 1);
  }, []);

  // Warn only while writes are genuinely outstanding. A blanket beforeunload
  // handler on a page that autosaves trains people to ignore the dialog.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (inFlight.current === 0 && timers.current.size === 0) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    const pendingTimers = timers.current;
    const saved = savedTimer;
    return () => {
      for (const t of pendingTimers.values()) clearTimeout(t);
      clearTimeout(saved.current);
    };
  }, []);

  return { status, queue, flush, cancel };
}
