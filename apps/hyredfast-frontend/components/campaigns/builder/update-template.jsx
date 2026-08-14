"use client";

import { useCallback, useEffect, useState } from "react";
import useSWRMutation from "swr/mutation";
import { patch } from "@/lib/apis";
import { mutate } from "swr";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { SaveStatus } from "@/components/save-status";
import { useAutosave } from "@/hooks/use-autosave";
import { InformationCircleIcon } from "mage-icons-react/bulk";
import { AnimatePresence, motion } from "framer-motion";
import AIButton from "@/components/campaigns/builder/ai-button";

// Mirrors the personalization data the send path builds for every contact.
// Anything outside this list renders as an empty string in the delivered mail.
const TEMPLATE_VARIABLES = ["name", "email"];

const UpdateTemplate = ({ message, stage, campaign, subject }) => {
  const [text, updateText] = useState(message);
  const [subjectValue, updateSubjectValue] = useState(subject);
  const [loading, setLoading] = useState(false);

  const { trigger } = useSWRMutation(
    `/api/pitches/update?pitch=${stage.id}`,
    patch,
    {
      onSuccess: () => {
        mutate(`/api/pitches?campaign=${campaign}`);
      },
    },
  );

  const { status, save } = useAutosave(
    useCallback((payload) => trigger(payload), [trigger]),
  );

  useEffect(() => {
    updateText(message);
    updateSubjectValue(subject);
  }, [stage, message, subject]);

  // Callers pass what they just changed: state hasn't flushed when a control
  // fires its blur handler.
  const commit = (overrides = {}) =>
    save({ message: text, subject: subjectValue, ...overrides });

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-4">
      <AnimatePresence>
        {loading && (
          <motion.div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-white/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              role="status"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-lg border border-border bg-white p-6 text-center"
            >
              <p className="mb-2 text-sm font-medium">Enhancing your email</p>
              <div className="flex animate-pulse justify-center space-x-1">
                <div className="size-2 rounded-full bg-primary" />
                <div className="size-2 rounded-full bg-primary" />
                <div className="size-2 rounded-full bg-primary" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          To: contacts in campaign
        </p>
        <SaveStatus status={status} />
      </div>

      <div>
        <Label htmlFor="subject" className="mb-2 block">
          Subject Line
        </Label>
        <Input
          id="subject"
          value={subjectValue}
          onChange={(event) => updateSubjectValue(event.target.value)}
          placeholder="Subject"
          className="border-border"
          onBlur={() => commit()}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <Label className="mb-2 block">Email Body</Label>
        <RichTextEditor
          className="min-h-[260px] flex-1"
          content={text}
          variables={TEMPLATE_VARIABLES}
          placeholder="Start typing your email content..."
          onChange={updateText}
          onBlur={(html) => commit({ message: html })}
        />
      </div>

      {/* The rewrite replaces the body without the editor ever blurring, so it
          persists its own result rather than waiting for the next blur. */}
      <AIButton
        text={text}
        updateText={(html) => {
          updateText(html);
          commit({ message: html });
        }}
        setLoading={setLoading}
      />

      <div className="flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <InformationCircleIcon className="mt-0.5 size-4 shrink-0" />
        <p>
          Available variables:{" "}
          <code className="rounded border border-border bg-accent px-1 py-0.5">
            {"{{name}}"}
          </code>{" "}
          and{" "}
          <code className="rounded border border-border bg-accent px-1 py-0.5">
            {"{{email}}"}
          </code>
          . More are on the way.
        </p>
      </div>
    </div>
  );
};

export default UpdateTemplate;
