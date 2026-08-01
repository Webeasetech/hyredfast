"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSquareIcon, EmailIcon, UserIcon } from "mage-icons-react/bulk";

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

  const statusDot = {
    PENDING: "bg-yellow-400",
    RUNNING: "bg-blue-400",
    COMPLETED: "bg-green-400",
    REPLIED: "bg-purple-400",
    OPENED: "bg-indigo-400",
    BOUNCED: "bg-red-400",
    FAILED: "bg-red-600",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border border-border p-3 cursor-pointer  transition-shadow ${
        isOverlay ? " rotate-2" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <UserIcon className="w-3 h-3 text-muted-foreground shrink-0" />
            <p className="text-sm font-medium truncate">{name}</p>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <EmailIcon className="w-[11px] h-[11px] text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </div>

        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <DotsSquareIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-1.5 mt-2">
        <span
          className={`w-2 h-2 rounded-full ${statusDot[status] || "bg-muted-foreground"}`}
        />
        <span className="text-[10px] text-muted-foreground uppercase">
          {status}
        </span>
      </div>
    </div>
  );
}
