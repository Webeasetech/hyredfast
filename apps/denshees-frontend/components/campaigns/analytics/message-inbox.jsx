"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { DateTime } from "luxon";
import {
  EmailIcon,
  EmailOpenedIcon,
  StarIcon,
  UserIcon,
  DotsHorizontalSquareIcon,
  CancelIcon,
  AeroplaneIcon,
} from "mage-icons-react/bulk";
import { ArrowLeftIcon, ReloadIcon } from "mage-icons-react/stroke";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import useSWR from "swr";
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
        onClick={() => setExpanded((p) => !p)}
        className="my-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs text-muted-foreground bg-accent border border-border rounded hover:bg-muted transition-colors"
      >
        <DotsHorizontalSquareIcon className="w-3.5 h-3.5" />
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
            <div className="whitespace-pre-wrap text-muted-foreground border-l-2 border-border pl-3 mt-1">
              {quoted}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const MessageInbox = ({ campaignId }) => {
  const { data, error, isLoading, mutate } = useSWR(
    campaignId ? `/api/inbox/${campaignId}` : null,
    fetcher,
  );

  const [selectedId, setSelectedId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [starredIds, setStarredIds] = useState(new Set());
  const textareaRef = useRef(null);

  const messages = data || [];
  const selectedMessage = messages.find((m) => m.id === selectedId) || null;

  const handleSelect = useCallback((msg) => {
    setSelectedId(msg.id);
    setReplyText("");
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId(null);
    setReplyText("");
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
        campaignEmailId: selectedMessage.campaign_email,
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
      <div className="border border-border bg-white p-4 h-[300px] flex items-center justify-center rounded-lg">
        <p className="text-red-600 text-sm">Error loading messages</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="border border-border bg-white h-[400px] flex items-center justify-center rounded-lg">
        <ReloadIcon className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Overlay + Expanded message */}
      <AnimatePresence>
        {selectedMessage && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-primary/20 backdrop-blur-[2px] z-40"
              onClick={handleBack}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                key="expanded"
                layoutId={`message-card-${selectedId}`}
                className="bg-white border border-border w-full max-w-2xl max-h-[80vh] flex flex-col pointer-events-auto rounded-lg"
                onClick={(e) => e.stopPropagation()}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              >
                {/* Expanded header */}
                <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted">
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-2 text-sm font-medium hover:bg-muted px-2 py-1 rounded transition-colors"
                  >
                    <ArrowLeftIcon className="w-4 h-4" />
                    Back to inbox
                  </button>
                  <button
                    onClick={handleBack}
                    className="hover:bg-muted p-1 rounded transition-colors"
                  >
                    <CancelIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Sender info */}
                <div className="px-4 py-3 border-b border-border">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                      {(
                        selectedMessage.expand?.campaign_email?.name?.[0] || "?"
                      ).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {selectedMessage.expand?.campaign_email?.name ||
                            "Unknown Contact"}
                        </span>
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
                </div>

                {/* Message body */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="px-4 py-4">
                    <CollapsibleThread text={selectedMessage.text} />
                  </div>
                </div>

                {/* Reply area */}
                <div className="border-t border-border bg-muted p-4">
                  <div className="border border-border rounded bg-white focus-within:border-border focus-within: transition-all">
                    <textarea
                      ref={textareaRef}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={`Reply to ${selectedMessage.expand?.campaign_email?.name || "contact"}...`}
                      rows={3}
                      className="w-full resize-none text-sm p-3 outline-hidden bg-transparent placeholder:text-muted-foreground"
                    />
                    <div className="flex items-center justify-between px-3 pb-2">
                      <p className="text-[11px] text-muted-foreground">
                        {typeof navigator !== "undefined" &&
                        navigator?.platform?.includes("Mac")
                          ? "⌘"
                          : "Ctrl"}{" "}
                        + Enter to send
                      </p>
                      <button
                        onClick={handleReply}
                        disabled={!replyText.trim() || sending}
                        className={cn(
                          "inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium border border-border transition-all",
                          replyText.trim() && !sending
                            ? "bg-primary text-primary-foreground  hover:translate-x-px hover:translate-y-px "
                            : "bg-accent text-muted-foreground cursor-not-allowed",
                        )}
                      >
                        {sending ? (
                          <ReloadIcon className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <AeroplaneIcon className="w-3.5 h-3.5" />
                        )}
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Inbox list */}
      <div className="border border-border bg-white h-[400px] overflow-hidden flex flex-col rounded-lg">
        {/* Inbox header */}
        <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-3">
          <div className="flex items-center gap-2">
            <EmailIcon className="w-4 h-4 text-foreground" />
            <h3 className="font-semibold text-sm">Inbox</h3>
            {messages.length > 0 && (
              <span className="text-[11px] bg-primary text-primary-foreground px-1.5 py-0.5 font-mono font-bold">
                {messages.length}
              </span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Recent Replies
          </span>
        </div>

        {/* Message list */}
        <ScrollArea className="flex-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <EmailOpenedIcon className="w-8 h-8 mb-2" />
              <p className="text-sm">No replies yet</p>
              <p className="text-xs mt-1">Replies will appear here</p>
            </div>
          ) : (
            <div>
              {messages.slice(0, 6).map((message) => (
                <motion.div
                  key={message.id}
                  layoutId={`message-card-${message.id}`}
                  onClick={() => handleSelect(message)}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border group",
                    "hover:bg-muted hover:shadow-[inset_3px_0_0_0_black]",
                    selectedId === message.id && "opacity-0",
                  )}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                >
                  {/* Avatar */}
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {(
                      message.expand?.campaign_email?.name?.[0] || "?"
                    ).toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">
                        {message.expand?.campaign_email?.name ||
                          "Unknown Contact"}
                      </span>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap ml-auto shrink-0">
                        {DateTime.fromJSDate(
                          new Date(message.created),
                        ).toRelative()}
                      </span>
                    </div>
                    <p className="text-sm text-foreground truncate mt-0.5">
                      {message.text?.slice(0, 60)}
                      {message.text?.length > 60 ? "..." : ""}
                    </p>
                  </div>

                  {/* Star */}
                  <button
                    onClick={(e) => toggleStar(e, message.id)}
                    className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <StarIcon
                      className={cn(
                        "w-3.5 h-3.5",
                        "transition-colors",
                        starredIds.has(message.id)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground hover:text-muted-foreground",
                      )}
                    />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </>
  );
};

export default MessageInbox;
