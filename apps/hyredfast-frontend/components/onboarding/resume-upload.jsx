"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { RESUME_ACCEPT, RESUME_MAX_BYTES } from "@/lib/constants/onboarding";

/**
 * Drop a résumé, get back the fields we read out of it.
 *
 * The file is sent to /api/onboarding/resume, parsed there, and dropped — it is
 * never persisted. What comes back is handed to `onParsed` and travels with the
 * rest of the answers, which is why the copy here can promise we don't keep it.
 */
export function ResumeUpload({ result, onParsed, token }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const upload = async (file) => {
    if (!file) return;

    if (file.size > RESUME_MAX_BYTES) {
      toast.error("That file is larger than 5MB");
      return;
    }

    try {
      setUploading(true);
      const body = new FormData();
      body.append("file", file);

      const res = await fetch("/api/onboarding/resume", {
        method: "POST",
        headers: { Authorization: token },
        body,
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Couldn't read that résumé");
        return;
      }

      onParsed({ fileName: data.fileName, parsed: data.parsed });
    } catch (error) {
      console.error("Résumé upload error:", error);
      toast.error("Couldn't read that résumé");
    } finally {
      setUploading(false);
      // Clearing lets the same file be picked again after a failure.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (result) {
    return <ParsedSummary result={result} onClear={() => onParsed(null)} />;
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={RESUME_ACCEPT}
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />

      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 transition-colors",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border bg-background hover:border-primary/40 hover:bg-muted/40",
          uploading && "cursor-wait",
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-sm font-medium">Reading your résumé...</span>
            <span className="text-xs text-muted-foreground">
              Takes a few seconds
            </span>
          </>
        ) : (
          <>
            <Upload className="size-6 text-muted-foreground" />
            <span className="text-sm font-medium">
              Drop your résumé here, or click to browse
            </span>
            <span className="text-xs text-muted-foreground">
              PDF, DOCX or TXT, up to 5MB
            </span>
          </>
        )}
      </button>
    </div>
  );
}

function ParsedSummary({ result, onClear }) {
  const { parsed, fileName } = result;
  const skills = (parsed?.skills || []).slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-primary/30 bg-primary/5 p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Check className="size-4" strokeWidth={3} />
        </span>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="font-medium">Got it, here&apos;s what we read</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="size-3" />
              <span className="truncate">{fileName}</span>
            </p>
          </div>

          <dl className="space-y-1.5 text-sm">
            {parsed?.headline && (
              <Row label="Current role" value={parsed.headline} />
            )}
            {parsed?.yearsOfExperience > 0 && (
              <Row
                label="Experience"
                value={`${parsed.yearsOfExperience} years`}
              />
            )}
            {parsed?.companies?.length > 0 && (
              <Row label="Worked at" value={parsed.companies.join(", ")} />
            )}
          </dl>

          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <Chip key={skill} variant="primary" size="sm">
                  {skill}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClear}
          aria-label="Remove résumé"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </motion.div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 truncate">{value}</dd>
    </div>
  );
}
