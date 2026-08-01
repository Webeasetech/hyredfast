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
    <div className="shrink-0 w-[280px]">
      {/* Column header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 border border-border bg-white mb-2 rounded-lg">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full border border-border"
            style={{ backgroundColor: stage.color || "#6B7280" }}
          />
          <span className="text-sm font-semibold truncate max-w-[160px]">
            {stage.name}
          </span>
        </div>
        <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] leading-none min-w-[20px] h-[20px] px-1.5">
          {deals.length}
        </span>
      </div>

      {/* Cards area */}
      <div
        ref={setNodeRef}
        className={`space-y-2 h-[calc(100vh-200px)] overflow-y-auto p-2 border border-dashed transition-colors ${
          isOver ? "border-border bg-accent" : "border-border bg-muted/50"
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
