"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { ClockIcon } from "mage-icons-react/bulk";

const DelayNode = ({ data }) => {
  const { pitch, delayDays, onSave } = data;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(delayDays);
  const inputRef = useRef(null);

  useEffect(() => setValue(delayDays), [delayDays]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const days = Number(value);
    if (!Number.isInteger(days) || days < 0) {
      setValue(delayDays);
      return;
    }
    if (days !== delayDays) onSave(pitch, days);
  };

  return (
    <div className="flex h-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-foreground">
      <Handle
        type="target"
        position={Position.Left}
        className="size-2! rounded-full! border-2! border-background! bg-border!"
      />

      <ClockIcon className="size-3.5 shrink-0 text-muted-foreground" />

      {editing ? (
        <input
          ref={inputRef}
          type="number"
          min={0}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") {
              setValue(delayDays);
              setEditing(false);
            }
          }}
          className="w-10 rounded border border-input px-1 text-center text-sm font-medium text-foreground outline-hidden"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Wait{" "}
          <span className="font-semibold text-foreground">{delayDays}</span>
          {delayDays === 1 ? " day" : " days"}
        </button>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="size-2! rounded-full! border-2! border-background! bg-border!"
      />
    </div>
  );
};

export default memo(DelayNode);
