"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import KanbanCard from "./kanban-card";

export default function KanbanColumn({ stage, deals, onDealClick }) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { type: "column", stage },
  });

  return (
    // The stage is one card: a header with rounded top corners sitting flush on
    // a body that carries the matching rounded bottom. The body's top border is
    // dropped so the two read as a single surface rather than stacked boxes.
    <div
      className={`flex w-[280px] shrink-0 flex-col overflow-hidden rounded-lg border transition-colors ${
        isOver ? "border-primary" : "border-border"
      }`}
    >
      {/* Column header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-white px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: stage.color || "#6B7280" }}
          />
          <span className="truncate text-sm font-semibold">{stage.name}</span>
        </div>
        <span className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] leading-none font-medium text-muted-foreground tabular-nums">
          {deals.length}
        </span>
      </div>

      {/* Cards area */}
      <div
        ref={setNodeRef}
        className={`h-[calc(100vh-240px)] space-y-2 overflow-y-auto p-2 transition-colors ${
          isOver ? "bg-primary/5" : "bg-muted/40"
        }`}
      >
        <SortableContext
          items={deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {deals.map((deal) => (
            <KanbanCard
              key={deal.id}
              deal={deal}
              onClick={() => onDealClick(deal)}
            />
          ))}
        </SortableContext>

        {deals.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            Drop leads here
          </div>
        )}
      </div>
    </div>
  );
}
