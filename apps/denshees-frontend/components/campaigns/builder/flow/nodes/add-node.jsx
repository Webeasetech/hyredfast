"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { PlusIcon } from "mage-icons-react/stroke";

const AddNode = ({ data }) => (
  <div className="h-full">
    <Handle
      type="target"
      position={Position.Left}
      className="size-2! rounded-full! border-2! border-background! bg-border!"
    />

    <button
      type="button"
      onClick={data.onAdd}
      disabled={data.disabled}
      className="flex h-full w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      <PlusIcon className="size-3.5" />
      Add follow-up
    </button>
  </div>
);

export default memo(AddNode);
