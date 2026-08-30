"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { DateTime } from "luxon";
import {
  EmailIcon,
  EmailOpenedIcon,
  StarIcon,
  DotsHorizontalSquareIcon,
  AeroplaneIcon,
} from "mage-icons-react/bulk";
import { ReloadIcon } from "mage-icons-react/stroke";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import useSWRInfinite from "swr/infinite";
import fetcher from "@/lib/fetcher";
import instance from "@/lib/axios";
import { cn } from "@/lib/utils";

// Split email text into the main reply and the quoted thread
function splitThread(text) {
  if (!text) return { body: "", quoted: "" };
  // Match "On <date> <someone> wrote:" pattern (Gmail style)
  const onWroteMatch = text.match(/\n\s*On .+wrote:\s*\n/);
  if (onWroteMatch) {
    const idx = onWroteMatch.index;
    return {
      body: text.slice(0, idx).trimEnd(),
      quoted: text.slice(idx).trimStart(),
    };
  }
  // Match lines starting with ">" (standard quoting)
  const lines = text.split("\n");
  const firstQuotedIdx = lines.findIndex((l) => /^>/.test(l.trim()));
  if (firstQuotedIdx > 0) {
    return {
      body: lines.slice(0, firstQuotedIdx).join("\n").trimEnd(),
      quoted: lines.slice(firstQuotedIdx).join("\n").trimStart(),
    };
  }
  return { body: text, quoted: "" };
}

function CollapsibleThread({ text }) {
  const [expanded, setExpanded] = useState(false);
  const { body, quoted } = useMemo(() => splitThread(text), [text]);

  if (!quoted) {
    return (
      <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
        {body}
      </div>
    );
  }

  return (
    <div className="text-sm leading-relaxed text-foreground">
      <div className="whitespace-pre-wrap">{body}</div>
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="my-2 inline-flex items-center gap-1 rounded-md border border-border bg-accent px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
      >
        <DotsHorizontalSquareIcon className="size-3.5" />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1 border-l-2 border-border pl-3 whitespace-pre-wrap text-muted-foreground">
              {quoted}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ContactAvatar({ name, className }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground",
        className,
      )}
    >
      {(name?.[0] || "?").toUpperCase()}
    </div>
  );
}

const getInboxKey = (campaignId) => (pageIndex, previousPage) => {
  if (!campaignId) return null;
  // The last page's null cursor is the "no more messages" signal.
  if (previousPage && !previousPage.nextCursor) return null;
  if (pageIndex === 0) return `/api/inbox/${campaignId}`;
  return `/api/inbox/${campaignId}?cursor=${previousPage.nextCursor}`;
};

const MessageInbox = ({ campaignId }) => {
  const { data, error, isLoading, isValidating, size, setSize, mutate } =
    useSWRInfinite(getInboxKey(campaignId), fetcher);

  const [selectedId, setSelectedId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [starredIds, setStarredIds] = useState(new Set());
  const textareaRef = useRef(null);
  const sentinelRef = useRef(null);

  const messages = useMemo(
    () => (data ?? []).flatMap((page) => page.items),
    [data],
  );
  const hasMore = data ? Boolean(data[data.length - 1]?.nextCursor) : false;
  const isLoadingMore = isLoading || (isValidating && size > 0);

  // Loads the next page once the last row scrolls into view, rather than a
  // fixed slice(0, 6) that never revealed anything past the first screen.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isValidating) setSize((s) => s + 1);
      },
      { rootMargin: "80px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isValidating, setSize]);

  const selectedMessage = messages.find((m) => m.id === selectedId) || null;

  const handleSelect = useCallback((msg) => {
    setSelectedId(msg.id);
    setReplyText("");
  }, []);

  const handleOpenChange = useCallback((open) => {
    if (!open) {
      setSelectedId(null);
      setReplyText("");
    }
  }, []);

  const toggleStar = useCallback((e, id) => {
    e.stopPropagation();
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleReply = async () => {
    if (!replyText.trim() || !selectedMessage) return;
    setSending(true);
    try {
      await instance.post(`/api/inbox/${campaignId}/reply`, {
        // The id is on the message row itself. It used to be read as
        // `selectedMessage.campaign_email`, which is where the *lead object*
        // lives — and only under `expand` — so this always sent undefined and
        // the route answered 400.
        campaignLeadId: selectedMessage.campaignLeadId,
        text: replyText.trim(),
        messageId: selectedMessage.id,
      });
      setReplyText("");
      mutate();
    } catch (err) {
      console.error("Failed to send reply:", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleReply();
    }
  };

  if (error) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-border bg-background p-4">
        <p className="text-sm text-destructive">Error loading messages</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-border bg-background">
        <ReloadIcon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Dialog open={!!selectedMessage} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[80vh] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0">
          {selectedMessage && (
            <>
              <DialogHeader className="border-b border-border px-4 py-3 pr-10">
                <div className="flex items-start gap-3">
                  <ContactAvatar
                    name={selectedMessage.expand?.campaign_email?.name}
                    className="mt-0.5 size-10 text-sm"
                  />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-sm font-semibold">
                        {selectedMessage.expand?.campaign_email?.name ||
                          "Unknown Contact"}
                      </DialogTitle>
                      <span className="text-xs text-muted-foreground">
                        {DateTime.fromJSDate(
                          new Date(selectedMessage.created),
                        ).toRelative()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedMessage.expand?.campaign_email?.email ||
                        "No email"}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <CollapsibleThread text={selectedMessage.text} />
              </div>

              <div className="border-t border-border bg-muted p-4">
                <div className="rounded-lg border border-border bg-background focus-within:border-ring">
                  <Textarea
                    ref={textareaRef}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Reply to ${selectedMessage.expand?.campaign_email?.name || "contact"}...`}
                    rows={3}
                    className="min-h-0 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                  />
                  <div className="flex items-center justify-between px-3 pb-2.5">
                    <p className="text-xs text-muted-foreground">
                      {typeof navigator !== "undefined" &&
                      navigator?.platform?.includes("Mac")
                        ? "⌘"
                        : "Ctrl"}{" "}
                      + Enter to send
                    </p>
                    <Button
                      size="sm"
                      onClick={handleReply}
                      disabled={!replyText.trim() || sending}
                    >
                      {sending ? (
                        <ReloadIcon className="size-3.5 animate-spin" />
                      ) : (
                        <AeroplaneIcon className="size-3.5" />
                      )}
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Inbox list */}
      <div className="flex h-[400px] flex-col overflow-hidden rounded-lg border border-border bg-background">
        {/* Inbox header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <EmailIcon className="size-4 text-foreground" />
            <h3 className="text-sm font-semibold">Inbox</h3>
            {messages.length > 0 && (
              <Badge className="h-4.5 min-w-4.5 justify-center px-1 text-[11px] tabular-nums">
                {messages.length}
              </Badge>
            )}
          </div>
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Recent Replies
          </span>
        </div>

        {/* Message list */}
        <ScrollArea className="min-h-0 flex-1">
          {messages.length === 0 ? (
            <div className="flex h-[300px] flex-col items-center justify-center text-muted-foreground">
              <EmailOpenedIcon className="mb-2 size-8" />
              <p className="text-sm">No replies yet</p>
              <p className="mt-1 text-xs">Replies will appear here</p>
            </div>
          ) : (
            <div>
              {messages.map((message) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => handleSelect(message)}
                  className="group flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent"
                >
                  <ContactAvatar
                    name={message.expand?.campaign_email?.name}
                    className="mt-0.5 size-8 text-xs"
                  />

                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">
                        {message.expand?.campaign_email?.name ||
                          "Unknown Contact"}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] whitespace-nowrap text-muted-foreground">
                        {DateTime.fromJSDate(
                          new Date(message.created),
                        ).toRelative()}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {message.text?.slice(0, 60)}
                      {message.text?.length > 60 ? "..." : ""}
                    </p>
                  </div>

                  {/* Star */}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => toggleStar(e, message.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleStar(e, message.id);
                      }
                    }}
                    className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <StarIcon
                      className={cn(
                        "size-3.5 transition-colors",
                        starredIds.has(message.id)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    />
                  </span>
                </button>
              ))}

              {hasMore && (
                <div ref={sentinelRef} className="flex justify-center py-3">
                  {isLoadingMore && (
                    <ReloadIcon className="size-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    </>
  );
};

export default MessageInbox;
