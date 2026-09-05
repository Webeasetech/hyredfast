"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * What the footer used to say, moved behind an icon.
 *
 * It was four lines of instruction under the sheet, read once and then read
 * past forever. The rules have not gone away, they are just no longer shouted
 * at someone who already knows them.
 *
 * Every point is shown as well as stated. The miniatures below are plain markup
 * copying the sheet's own look rather than the real components: they need to
 * hold a wrong value, a half-typed row and a red cell on purpose, which the
 * real grid would immediately try to fix.
 */

/** One cell of a miniature sheet. */
function Cell({ children, className, muted, head }) {
  return (
    <span
      className={cn(
        "flex h-6 items-center truncate border-r border-border px-1.5 text-[11px] last:border-r-0",
        head && "bg-muted font-medium uppercase tracking-wide",
        muted && "text-muted-foreground/50",
        className,
      )}
    >
      {children}
    </span>
  );
}

function MiniSheet({ children, className }) {
  return (
    <div className={cn("overflow-hidden rounded border border-border bg-white", className)}>
      {children}
    </div>
  );
}

function Row({ children, className }) {
  return (
    <div
      className={cn(
        "grid border-b border-border last:border-b-0",
        "grid-cols-[1.25rem_1fr_1.4fr_1fr]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** One numbered point: the picture beside the words, never instead of them. */
function Point({ title, children, visual }) {
  return (
    <section className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_15rem] sm:gap-6">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <div className="mt-1 space-y-1.5 text-sm text-muted-foreground">
          {children}
        </div>
      </div>
      <div className="sm:pt-0.5">{visual}</div>
    </section>
  );
}

export default function SheetHelpDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto bg-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>How this sheet works</DialogTitle>
          <DialogDescription>
            It behaves like the spreadsheet you were keeping, with the parts that
            used to go wrong taken care of.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Point
            title="Four columns are required"
            visual={
              <MiniSheet>
                <Row>
                  <Cell head />
                  <Cell head>
                    name <span className="text-red-500">*</span>
                  </Cell>
                  <Cell head>
                    email <span className="text-red-500">*</span>
                  </Cell>
                  <Cell head>signature</Cell>
                </Row>
                <Row>
                  <Cell className="justify-center bg-muted/40 text-muted-foreground">
                    1
                  </Cell>
                  <Cell>Priya</Cell>
                  <Cell>priya@acme.com</Cell>
                  <Cell muted>signature</Cell>
                </Row>
                <Row>
                  <Cell className="justify-center bg-muted/40 text-muted-foreground">
                    2
                  </Cell>
                  <Cell>Sam</Cell>
                  <Cell className="bg-red-50 text-red-700">sam@</Cell>
                  <Cell muted>signature</Cell>
                </Row>
              </MiniSheet>
            }
          >
            <p>
              Name, email, company and role carry a red asterisk. A lead without
              all four cannot be published, and neither can one whose address
              does not look like an address.
            </p>
            <p>
              Nothing stops you typing. Press publish and every cell in the way
              turns red at once, so you fix them in one pass instead of being
              interrupted per keystroke.
            </p>
          </Point>

          <Point
            title="The next row appears as you finish one"
            visual={
              <MiniSheet>
                <Row>
                  <Cell head />
                  <Cell head>name</Cell>
                  <Cell head>email</Cell>
                  <Cell head>signature</Cell>
                </Row>
                <Row>
                  <Cell className="justify-center bg-muted/40 text-muted-foreground">
                    1
                  </Cell>
                  <Cell>Priya</Cell>
                  <Cell>priya@acme.com</Cell>
                  <Cell muted>signature</Cell>
                </Row>
                <Row className="bg-primary/5">
                  <Cell className="justify-center bg-muted/40 text-muted-foreground">
                    2
                  </Cell>
                  <Cell muted>name</Cell>
                  <Cell muted>name@company.com</Cell>
                  <Cell muted>signature</Cell>
                </Row>
              </MiniSheet>
            }
          >
            <p>
              Fill a row and an empty one opens beneath it. No button, and no
              screen of half-filled rows: the next one arrives once the current
              lead has a name, an email, a company and a role.
            </p>
            <p>
              Copy a block of cells out of Google Sheets or Excel and paste it
              anywhere in the grid to fill many rows at once. Arrow keys move
              between cells, Tab moves across, Enter moves down.
            </p>
          </Point>

          <Point
            title="Some columns come from your emails"
            visual={
              <div className="space-y-2">
                <div className="rounded border border-border bg-white p-2 text-[11px] leading-relaxed">
                  <p className="text-muted-foreground">Hi {"{{name}}"},</p>
                  <p className="text-muted-foreground">
                    I&apos;d love to apply at {"{{company}}"}.
                  </p>
                  <p>
                    <span className="rounded bg-primary/15 px-1 font-medium text-primary">
                      {"{{signature}}"}
                    </span>
                  </p>
                </div>
                <p aria-hidden="true" className="text-center text-xs text-muted-foreground">
                  ↓
                </p>
                <MiniSheet>
                  <Row className="grid-cols-[1fr_1fr]">
                    <Cell head>name</Cell>
                    <Cell head className="bg-primary/15 text-primary">
                      signature
                    </Cell>
                  </Row>
                  <Row className="grid-cols-[1fr_1fr]">
                    <Cell>Priya</Cell>
                    <Cell muted>signature</Cell>
                  </Row>
                </MiniSheet>
              </div>
            }
          >
            <p>
              Every {"{{variable}}"} your email templates use becomes a column
              here. Edit a pitch and the columns follow, so the sheet always asks
              for exactly what the emails will need.
            </p>
            <p>
              That is the misspelled-header problem gone: the columns are not
              yours to name, so they cannot be named wrongly.
            </p>
          </Point>

          <Point
            title="Draft now, published when you say so"
            visual={
              <div className="space-y-2">
                <div className="rounded border border-dashed border-amber-300 bg-amber-50/60 p-2">
                  <p className="text-[11px] font-medium text-amber-800">
                    Draft — this sheet
                  </p>
                  <p className="mt-0.5 text-[11px] text-amber-800/80">
                    Saved as you type. Nothing sent, nothing charged.
                  </p>
                </div>
                <p aria-hidden="true" className="text-center text-xs text-muted-foreground">
                  ↓ publish
                </p>
                <div className="rounded border border-border bg-white p-2">
                  <p className="text-[11px] font-medium">Campaign leads</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Queued for sending. The sheet starts empty again.
                  </p>
                </div>
              </div>
            }
          >
            <p>
              Every keystroke is saved to your draft. Close the tab, log out,
              come back next week — the sheet is where you left it, and nothing
              in it has been emailed.
            </p>
            <p>
              Publishing moves the leads into the campaign and clears the sheet
              for the next batch.
            </p>
          </Point>
        </div>
      </DialogContent>
    </Dialog>
  );
}
