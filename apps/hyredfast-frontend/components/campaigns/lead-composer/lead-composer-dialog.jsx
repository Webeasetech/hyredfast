"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LeadComposer from "@/components/campaigns/lead-composer/lead-composer";

/**
 * The composer, full screen.
 *
 * Full bleed rather than a centred panel because this is a spreadsheet: the
 * useful thing to give it is width for columns and height for rows.
 *
 * Nothing guards the close. Every keystroke is already saved to the draft, so
 * dismissing this is not destructive — a confirm here would only teach people
 * that the autosave they are being asked to trust cannot be trusted.
 */
export default function LeadComposerDialog({
  open,
  onOpenChange,
  campaignId,
  onCommitted,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Override the centred, max-w-lg default: pinned to all four corners,
        // square, and laid out as a column so the grid gets the leftover height.
        className="top-0 left-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 sm:max-w-none"
      >
        <DialogHeader className="border-b border-border px-4 py-3 md:px-6">
          <DialogTitle className="text-xl">Import leads</DialogTitle>
          <DialogDescription>
            Everything you type is saved as you go — close this whenever and
            pick it up later.
          </DialogDescription>
        </DialogHeader>

        {/* Mounted only while open, so each visit reads the draft fresh and the
            autosave flush on unmount runs when the dialog closes. */}
        {open && (
          <LeadComposer campaignId={campaignId} onCommitted={onCommitted} />
        )}
      </DialogContent>
    </Dialog>
  );
}
