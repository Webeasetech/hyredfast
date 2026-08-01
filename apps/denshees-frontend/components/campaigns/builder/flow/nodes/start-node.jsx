"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
// Bulk only ships arrows inside circle/square wrappers; the stroke set has
// the plain glyph, so this one node icon breaks from the bulk family.
import { ArrowUpIcon } from "mage-icons-react/stroke";

const StartNode = ({ data }) => (
  <div className="flex h-full items-center gap-3 rounded-lg border border-primary bg-primary px-4 py-3 text-primary-foreground">
    <ArrowUpIcon className="size-5 shrink-0" />
    <div>
      <div className="text-sm font-semibold leading-tight">Campaign start</div>
      <div className="text-xs text-primary-foreground/70">
        {data.totalContacts} leads
      </div>
    </div>

    <Handle
      type="source"
      position={Position.Right}
      className="size-2! rounded-full! border-2! border-background! bg-border!"
    />
  </div>
);

export default memo(StartNode);
