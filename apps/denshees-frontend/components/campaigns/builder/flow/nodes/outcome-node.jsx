"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { MessageSquareIcon, EyeIcon, CancelIcon } from "mage-icons-react/bulk";
import { cn } from "@/lib/utils";

// Three outcomes need to stay visually distinct at a glance; everything else
// in the flow leans on primary + neutrals, so these two accents are reused
// from the same emerald/blue the rest of the app already uses for "replied"
// and "active" states (see components/ui/status-chip.jsx).
const VARIANTS = {
  replied: {
    icon: MessageSquareIcon,
    text: "text-emerald-600",
    bar: "bg-emerald-600",
  },
  opened: {
    icon: EyeIcon,
    text: "text-blue-600",
    bar: "bg-blue-600",
  },
  noReply: {
    icon: CancelIcon,
    text: "text-muted-foreground",
    bar: "bg-muted-foreground",
  },
};

const OutcomeNode = ({ data }) => {
  const { label, count, percentage, type } = data;
  const variant = VARIANTS[type] ?? VARIANTS.noReply;
  const Icon = variant.icon;

  return (
    <div className="flex h-full flex-col justify-between rounded-lg border border-border bg-background px-3 py-2.5">
      <Handle
        type="target"
        position={Position.Top}
        className="size-2! rounded-full! border-2! border-background! bg-border!"
      />

      <div className="flex items-center gap-1.5">
        <Icon className={cn("size-3.5 shrink-0", variant.text)} />
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>

      <div className="text-xl leading-none font-semibold">{count}</div>

      <div>
        <div className="text-[10px] text-muted-foreground">{percentage}%</div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full", variant.bar)}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(OutcomeNode);
