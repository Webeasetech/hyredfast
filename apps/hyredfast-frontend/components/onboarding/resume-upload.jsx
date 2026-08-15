"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RESUME_ACCEPT, RESUME_MAX_BYTES } from "@/lib/constants/onboarding";

/**
 * Picks a résumé. Nothing more.
 *
 * Reading the file costs a few seconds, and making the user sit through that on
 * the last question is time they spend staring at a spinner before they can
 * finish. The file is held here and parsed during the hand-off screen instead,
 * where they are already waiting.
 */
export function ResumeUpload({ file, onSelect }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const accepted = RESUME_ACCEPT.split(",");

  const select = (picked) => {
    if (!picked) return;

    const name = picked.name.toLowerCase();
    if (!accepted.some((ext) => name.endsWith(ext))) {
      toast.error("Upload a PDF, DOCX, or TXT file");
      return;
    }

    if (picked.size > RESUME_MAX_BYTES) {
      toast.error("That file is larger than 5MB");
      return;
    }

    onSelect(picked);
  };

  const clear = () => {
    onSelect(null);
    // Lets the same file be picked again after removing it.
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={RESUME_ACCEPT}
        className="hidden"
        onChange={(e) => select(e.target.files?.[0])}
      />

      {file ? (
        <FilePreview file={file} onClear={clear} />
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            select(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 transition-colors",
            "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border bg-background hover:border-primary/40 hover:bg-muted/40",
          )}
        >
          <Upload className="size-6 text-muted-foreground" />
          <span className="text-sm font-medium">
            Drop your résumé here, or click to browse
          </span>
          <span className="text-xs text-muted-foreground">
            PDF, DOCX or TXT, up to 5MB
          </span>
        </button>
      )}
    </div>
  );
}

function FilePreview({ file, onClear }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <FileText className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatSize(file.size)} · we&apos;ll read it when you finish
        </p>
      </div>

      <button
        type="button"
        onClick={onClear}
        aria-label="Remove résumé"
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </motion.div>
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
