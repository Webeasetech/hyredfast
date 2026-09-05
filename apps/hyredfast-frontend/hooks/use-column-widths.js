"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Same for every column until dragged, and the floor a drag can't go under. */
export const DEFAULT_COLUMN_WIDTH = 176;
export const MIN_COLUMN_WIDTH = 96;

const storageKey = (scope) => `hyredfast:sheet-widths:${scope}`;

/**
 * Column widths for the lead sheet, remembered per campaign.
 *
 * localStorage rather than the draft row: a column width is how one person likes
 * to look at their screen, not part of the leads they are writing. Storing it
 * server-side would mean a write on every drag and a migration for a preference
 * that does not survive the draft it belongs to.
 *
 * Widths are keyed by column *name*, so every group's grid lines up as one
 * sheet, and a column the templates stop asking for takes its width with it.
 */
export function useColumnWidths(scope) {
  const [widths, setWidths] = useState({});
  // A fresh scope must not save the previous one's widths before it has read
  // its own, which is what a bare effect-on-change would do.
  const loaded = useRef(null);

  useEffect(() => {
    if (!scope) return;
    try {
      const raw = window.localStorage.getItem(storageKey(scope));
      setWidths(raw ? JSON.parse(raw) : {});
    } catch {
      setWidths({});
    }
    loaded.current = scope;
  }, [scope]);

  useEffect(() => {
    if (!scope || loaded.current !== scope) return;
    try {
      window.localStorage.setItem(storageKey(scope), JSON.stringify(widths));
    } catch {
      // A browser refusing to store a column width is not worth a message.
    }
  }, [scope, widths]);

  const setColumnWidth = useCallback((column, width) => {
    setWidths((prev) => ({
      ...prev,
      [column]: Math.max(MIN_COLUMN_WIDTH, Math.round(width)),
    }));
  }, []);

  const widthOf = useCallback(
    (column) => widths[column] ?? DEFAULT_COLUMN_WIDTH,
    [widths],
  );

  return { widthOf, setColumnWidth };
}
