"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Fire-and-report autosave.
 *
 * Callers decide *when* to save (blur for free text, change for toggles) — this
 * only owns the request lifecycle and the status the UI reflects back. Saves are
 * sequenced by a token so a slow earlier request can't overwrite the status of a
 * newer one, and identical payloads are skipped so a blur with no edit is a
 * no-op rather than a write.
 *
 * @param {(payload: any) => Promise<any>} saveFn
 * @returns {{ status: "idle"|"saving"|"saved"|"error", save: (payload: any) => Promise<void> }}
 */
export function useAutosave(saveFn) {
  const [status, setStatus] = useState("idle");
  const latest = useRef(0);
  const lastPayload = useRef(null);
  const savedTimer = useRef(null);

  const save = useCallback(
    async (payload) => {
      const serialised = JSON.stringify(payload);
      if (serialised === lastPayload.current) return;
      lastPayload.current = serialised;

      const token = ++latest.current;
      setStatus("saving");

      try {
        await saveFn(payload);
        if (token !== latest.current) return; // a newer save superseded this one
        setStatus("saved");
        clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setStatus("idle"), 2000);
      } catch (error) {
        if (token !== latest.current) return;
        // Let the next attempt through even though the payload is unchanged.
        lastPayload.current = null;
        setStatus("error");
        toast.error("Couldn't save your changes");
      }
    },
    [saveFn],
  );

  return { status, save };
}
