"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDownIcon } from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * How many leads a group shows before it fades out behind a "show all".
 *
 * A page is five whole groups, and a group can be any size — Stripe alone runs
 * to 22 leads. Capping the preview keeps a page skimmable at the level the
 * grouping is for ("who am I sending to?") without hiding the leads behind a
 * click the way a collapsed group does.
 */
const PREVIEW_ROWS = 5;

/** One easing for every transition here, so the block moves as one thing. */
const EASE = [0.4, 0, 0.2, 1];

/**
 * One company/role block of a campaign's leads.
 *
 * Mirrors the composer's LeadGroup, which is where these leads were written:
 * the pairing is stated once in a coloured header rather than repeated down two
 * columns of every row, and each block carries its own column header the way
 * the composer's grid does.
 *
 * Read-only, unlike the composer's version. Company and role are properties of
 * the draft the leads came from — changing them here would have to rewrite
 * every contact's personalization, and the place to do that is the composer.
 *
 * Collapsible, also unlike the composer's, which deliberately never collapses:
 * there the leads are the only thing on screen, here a page can carry seventy
 * of them across five companies.
 *
 * Built on framer-motion rather than the design system's Radix accordion: that
 * one animates height from a CSS keyframe, which cannot also cross-fade or
 * settle the way this does. The trigger keeps the accessible wiring Radix was
 * providing — a real button, aria-expanded, and a labelled region.
 */
export default function LeadGroupTable({ group, color, columns }) {
  // Per group, so sorting a block reorders that block rather than reshuffling
  // leads across companies — the grouping is the structure, sorting is inside it.
  const [sorting, setSorting] = useState([]);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  // Honour the OS setting: the same states, reached instantly.
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : 0.28;

  // The panel animates to a measured pixel height, not to `height: "auto"`.
  // "auto" is a constant as far as framer is concerned, so it has nothing to
  // animate between when the rows underneath it change — the element simply
  // reflows. Watching the content instead gives the height a real target, which
  // is what makes show-all/show-fewer animate rather than snap.
  //
  // Starts as "auto" so the first paint is correct without measuring; the
  // observer then swaps in the identical pixel value, which is not a visible
  // change, and every later resize animates from there.
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState("auto");

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      setContentHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const table = useReactTable({
    data: group.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });

  // A committed lead with no company or role is not an error the way an
  // incomplete draft group is — it just came from somewhere that never asked,
  // like Add Lead. So it reads as neutral here, not amber.
  //
  // Half-filled groups are real: the composer commits a lead as soon as its
  // row is valid, and plenty carry a company with the role still blank. Say
  // whichever half is known rather than treating the pair as all-or-nothing —
  // isGroupComplete is the gate for *committing*, not for describing.
  const named = Boolean(group.company || group.role);

  const rows = table.getRowModel().rows;
  const capped = !expanded && rows.length > PREVIEW_ROWS;
  const visibleRows = capped ? rows.slice(0, PREVIEW_ROWS) : rows;

  const label = named
    ? `${group.company || "No company"} — ${group.role || "no role set"}`
    : "Leads with no company or role set";

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border bg-white",
        named ? color.border : "border-border",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className={cn(
          "flex w-full items-center gap-3 border-b px-3 py-2 text-left",
          "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          named ? cn(color.header, color.border) : "bg-muted border-border",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            named ? color.muted : "text-muted-foreground",
          )}
        >
          {named ? (
            <>
              Applying
              {group.company && (
                <>
                  {" at "}
                  <span className={cn("font-medium", color.text)}>
                    {group.company}
                  </span>
                </>
              )}
              {group.role ? (
                <>
                  {" as "}
                  <span className={cn("font-medium", color.text)}>
                    {group.role}
                  </span>
                </>
              ) : (
                <span className="opacity-70"> — no role set</span>
              )}
            </>
          ) : (
            "No company or role set"
          )}
        </span>

        <span
          className={cn(
            "shrink-0 text-xs",
            named ? color.muted : "text-muted-foreground",
          )}
        >
          {group.rows.length} lead{group.rows.length === 1 ? "" : "s"}
        </span>

        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration, ease: EASE }}
          className={cn(
            "shrink-0",
            named ? color.muted : "text-muted-foreground",
          )}
        >
          <ChevronDownIcon className="size-4" />
        </motion.span>
      </button>

      <motion.div
        id={contentId}
        role="region"
        aria-label={label}
        // No mount animation: groups start open, so the first paint is the
        // open state rather than something that opens itself on arrival.
        initial={false}
        animate={{
          height: open ? contentHeight : 0,
          opacity: open ? 1 : 0,
        }}
        transition={{
          height: { duration, ease: EASE },
          // Fade a touch quicker than the collapse, so the rows are gone
          // before the edges meet rather than being squashed while visible.
          opacity: { duration: duration * 0.7, ease: EASE },
        }}
        className="overflow-hidden"
        // The rows stay mounted while collapsed so the panel's height is known
        // before it reopens — `inert` keeps them out of the tab order and the
        // accessibility tree while they are hidden behind a zero height.
        inert={!open}
      >
        {/* The measured element. Stays mounted while collapsed so its height is
            known the moment the panel reopens. */}
        <div ref={contentRef}>
          <div className="relative">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        style={{ width: header.column.columnDef.size }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* The cut is a fade rather than a hard edge, so the last visible
                  row reads as "there is more of this" instead of as the end of
                  the group. Transparent at the top so the rows show through it;
                  the overlay ignores the pointer so only the button is
                  clickable. */}
            <AnimatePresence>
              {capped && (
                <motion.div
                  key="fade"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration, ease: EASE }}
                  className="pointer-events-none absolute inset-x-0 bottom-0 flex h-28 items-end justify-center bg-gradient-to-t from-white via-white/85 to-transparent"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="pointer-events-auto mb-3 shadow-sm"
                    onClick={() => setExpanded(true)}
                  >
                    Show all {rows.length} leads
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {expanded && rows.length > PREVIEW_ROWS && (
            <div className="flex justify-center border-t border-border py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(false)}
              >
                Show fewer
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </section>
  );
}
