import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading placeholders that mirror the shape of what's arriving, so the layout
 * doesn't jump when real content lands. Each takes the same padding and rhythm
 * as the component it stands in for.
 */

/** Rows inside a bordered list card — campaigns, lead lists. */
export function ListRowsSkeleton({ rows = 5 }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 px-6 py-4"
        >
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-44" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A grid of stat/summary cards. */
export function CardsSkeleton({ count = 4, className }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-4">
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="mt-4 h-3 w-24" />
          <Skeleton className="mt-2 h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

/** A single bordered panel of text rows — settings sections, detail cards. */
export function PanelSkeleton({ lines = 3, className }) {
  return (
    <div className={cn("rounded-lg border border-border p-6", className)}>
      <Skeleton className="h-4 w-40" />
      <div className="mt-6 space-y-4">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Kanban-style columns. */
export function BoardSkeleton({ columns = 4, cards = 3 }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: columns }).map((_, c) => (
        <div
          key={c}
          className="flex w-[280px] shrink-0 flex-col overflow-hidden rounded-lg border border-border"
        >
          <div className="flex items-center justify-between border-b border-border bg-background px-3 py-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="size-5 rounded-full" />
          </div>
          <div className="space-y-2 bg-muted/40 p-2">
            {Array.from({ length: cards }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-background p-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <Skeleton className="size-7 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
                <Skeleton className="mt-2 h-4 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A chart or graph area. */
export function ChartSkeleton({ className }) {
  return (
    <div className={cn("rounded-lg border border-border p-4", className)}>
      <Skeleton className="h-3.5 w-32" />
      <div className="mt-4 flex h-40 items-end gap-2">
        {[45, 70, 35, 85, 60, 50, 75, 40, 65, 55].map((h, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}
