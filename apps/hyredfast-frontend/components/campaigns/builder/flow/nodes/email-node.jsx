"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { EmailIcon, MessageSquareIcon } from "mage-icons-react/bulk";
import { ArrowUpIcon } from "mage-icons-react/stroke";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const EmailNode = ({ data }) => {
  const {
    label,
    pitch,
    isSelected,
    isTerminal,
    isDeletable,
    onOpen,
    onDelete,
    contactCount,
    replyCount,
    totalContacts,
  } = data;

  const contactPercentage =
    totalContacts > 0 ? Math.round((contactCount / totalContacts) * 100) : 0;

  return (
    <div
      onClick={() => onOpen(pitch)}
      className={cn(
        "relative h-full cursor-pointer rounded-lg border px-4 py-3 transition-colors",
        isSelected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:border-primary/40",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="size-2! rounded-full! border-2! border-background! bg-border!"
      />

      {isDeletable && (
        <button
          type="button"
          title="Remove this follow-up"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(pitch);
          }}
          className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-destructive hover:bg-destructive hover:text-white"
        >
          <XIcon className="size-3" />
        </button>
      )}

      <div className="flex items-center gap-2">
        <EmailIcon className="size-4 shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight">{label}</div>
          <div
            className={cn(
              "max-w-[160px] truncate text-xs",
              isSelected
                ? "text-primary-foreground/75"
                : "text-muted-foreground",
            )}
          >
            {pitch.subject || "No subject"}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "mt-2 space-y-1 border-t pt-2",
          isSelected ? "border-primary-foreground/20" : "border-border",
        )}
      >
        <div className="flex items-center justify-between text-xs">
          <span
            className={cn(
              "flex items-center gap-1",
              isSelected
                ? "text-primary-foreground/75"
                : "text-muted-foreground",
            )}
          >
            <ArrowUpIcon className="size-3" />
            Contacts
          </span>
          <span className="font-medium">
            {contactCount}
            <span
              className={cn(
                "ml-1 text-[10px]",
                isSelected
                  ? "text-primary-foreground/60"
                  : "text-muted-foreground",
              )}
            >
              ({contactPercentage}%)
            </span>
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span
            className={cn(
              "flex items-center gap-1",
              isSelected
                ? "text-primary-foreground/75"
                : "text-muted-foreground",
            )}
          >
            <MessageSquareIcon className="size-3" />
            Replies
          </span>
          <span className="font-medium">{replyCount}</span>
        </div>
      </div>

      <Handle
        id="next"
        type="source"
        position={Position.Right}
        className="size-2! rounded-full! border-2! border-background! bg-border!"
      />

      {isTerminal && (
        <Handle
          id="outcome"
          type="source"
          position={Position.Bottom}
          className="size-2! rounded-full! border-2! border-background! bg-border!"
        />
      )}
    </div>
  );
};

export default memo(EmailNode);
