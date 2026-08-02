"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSquareIcon } from "mage-icons-react/bulk";

import { cn } from "@/lib/utils";

// Lead state is a status, so it keeps the reserved status colours rather than
// borrowing a brand or series colour.
const STATUS_STYLES = {
  PENDING: "bg-yellow-50 text-yellow-800",
  RUNNING: "bg-blue-50 text-blue-800",
  COMPLETED: "bg-green-50 text-green-800",
  REPLIED: "bg-emerald-50 text-emerald-800",
  OPENED: "bg-indigo-50 text-indigo-800",
  BOUNCED: "bg-orange-50 text-orange-800",
  FAILED: "bg-red-50 text-red-800",
};

const initialsOf = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

export default function KanbanCard({ deal, onClick, isOverlay = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: deal.id,
    data: { type: "card", deal },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const lead = deal.expand?.lead;
  const name = lead?.name || "Unknown";
  const email = lead?.email || "-";
  const status = lead?.status || "PENDING";

  return (
    // The whole card is the drag handle. The board's pointer sensor has a 5px
    // activation distance, so a plain click still opens the deal and only real
    // movement starts a drag.
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group cursor-grab rounded-lg border border-border bg-background p-2.5 transition-all active:cursor-grabbing",
        "hover:border-primary/40 hover:shadow-sm",
        isOverlay && "rotate-2 shadow-md",
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2.5">
        {/* Initials stand in for an avatar and give each row a fixed anchor. */}
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
          {initialsOf(name)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {email}
          </p>
        </div>

        {/* Purely a hint that the card is draggable — the listeners live on the
            card itself, so this must not swallow pointer events. */}
        <DotsSquareIcon
          aria-hidden="true"
          className="pointer-events-none size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>

      <div className="mt-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            STATUS_STYLES[status] || "bg-muted text-muted-foreground",
          )}
        >
          {status.charAt(0) + status.slice(1).toLowerCase()}
        </span>
      </div>
    </div>
  );
}
