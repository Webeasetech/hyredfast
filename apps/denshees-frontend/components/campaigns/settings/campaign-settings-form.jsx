"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveStatus } from "@/components/save-status";
import { useAutosave } from "@/hooks/use-autosave";
import useSWRMutation from "swr/mutation";
import { patch } from "@/lib/apis";
import { mutate } from "swr";
import { Checkbox } from "@/components/ui/checkbox";
import { InformationCircleIcon, CalendarIcon } from "mage-icons-react/bulk";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * One row per boolean setting. Shared so both toggles align identically —
 * they previously differed by a stray wrapper element and by living in
 * different layout contexts.
 */
const SettingToggle = ({ id, checked, onCheckedChange, label, hint, help }) => (
  <div className="flex items-start gap-2.5">
    <Checkbox
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="mt-0.5"
    />
    <div className="min-w-0">
      <Label htmlFor={id} className="block">
        {label}
      </Label>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="mt-0.5 cursor-help text-xs text-muted-foreground">
              {hint}
            </p>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">{help}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
);

const CampaignSettingsForm = ({ campaign, campaignData }) => {
  const [ignoreVerification, setIgnoreVerification] = useState(false);
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false);
  const [activeDays, setActiveDays] = useState([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [time, setTime] = useState("");

  const daysOfWeek = [
    { id: "monday", label: "Monday", short: "Mon" },
    { id: "tuesday", label: "Tuesday", short: "Tue" },
    { id: "wednesday", label: "Wednesday", short: "Wed" },
    { id: "thursday", label: "Thursday", short: "Thu" },
    { id: "friday", label: "Friday", short: "Fri" },
    { id: "saturday", label: "Saturday", short: "Sat" },
    { id: "sunday", label: "Sunday", short: "Sun" },
  ];

  useEffect(() => {
    if (campaignData) {
      setIgnoreVerification(campaignData.ignoreVerification);
      setIsTrackingEnabled(campaignData.isTrackingEnabled || false);
      setTitle(campaignData.title);
      setDesc(campaignData.desc);
      setTime(campaignData.emailDeliveryPeriod || "");
      setActiveDays(campaignData.activeDays || []);
    }
  }, [campaignData]);

  const { trigger } = useSWRMutation(`/api/campaign/${campaign}`, patch);

  const { status, save } = useAutosave(
    useCallback(
      async (payload) => {
        await trigger(payload);
        mutate(`/api/campaign/${campaign}`);
      },
      [trigger, campaign],
    ),
  );

  /**
   * Persists the form. Callers pass the value they just set, because state
   * updates haven't flushed yet at the point a control fires its change.
   * An incomplete form is never written — the inline hints below say why.
   */
  const commit = useCallback(
    (overrides = {}) => {
      const next = {
        title,
        desc,
        time,
        ignoreVerification,
        isTrackingEnabled,
        activeDays,
        ...overrides,
      };

      if (!next.title || !next.desc || !next.time || !next.activeDays.length) {
        return;
      }

      save({
        title: next.title,
        desc: next.desc,
        email_delivery_period: next.time,
        ignore_verification: next.ignoreVerification,
        isTrackingEnabled: next.isTrackingEnabled,
        active_days: next.activeDays,
      });
    },
    [
      title,
      desc,
      time,
      ignoreVerification,
      isTrackingEnabled,
      activeDays,
      save,
    ],
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
      className="space-y-8"
    >
      <div className="border border-border bg-white p-6 rounded-lg">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Campaign Details</h2>
          <SaveStatus status={status} />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="title" className="mb-2 block">
              Campaign Title
            </Label>
            <Input
              name="title"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => commit()}
              className="border-border"
            />
          </div>

          <div>
            <Label htmlFor="desc" className="mb-2 block">
              Description
            </Label>
            <Input
              name="desc"
              id="desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={() => commit()}
              className="border-border"
            />
          </div>
        </div>

        {/* Left column carries the delivery time and both toggles; the day
            grid is three rows tall, so keeping it in its own column stops it
            pushing the toggles down the card. */}
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label htmlFor="time" className="mb-2 block">
                Email Delivery Time
              </Label>
              <div className="flex items-center">
                <Select
                  key={time} // Force re-render when time changes
                  value={time}
                  onValueChange={(value) => {
                    setTime(value);
                    commit({ time: value });
                  }}
                >
                  <SelectTrigger className="w-full border-border">
                    <SelectValue placeholder="When should the emails be sent?" />
                  </SelectTrigger>
                  <SelectContent className="border-border">
                    <SelectGroup>
                      <SelectLabel>Select time of the day...</SelectLabel>
                      <SelectItem value="MORNING">6 AM - 12 PM</SelectItem>
                      <SelectItem value="EVENING">12 PM - 6 PM</SelectItem>
                      <SelectItem value="NIGHT">6 PM - 12 AM</SelectItem>
                      <SelectItem value="MIDNIGHT">12 AM - 6 AM</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InformationCircleIcon className="w-4 h-4 ml-2 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-sm">
                        This is according to your local timezone!
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="space-y-3">
              <SettingToggle
                id="ignore-verification"
                checked={ignoreVerification}
                onCheckedChange={(v) => {
                  setIgnoreVerification(v);
                  commit({ ignoreVerification: v });
                }}
                label="Send emails to unverified contacts"
                hint="Warning: This can hurt the deliverability of your email account"
                help="Will ignore verification status and send emails to all contacts. This may increase bounce rates and affect your email reputation."
              />

              <SettingToggle
                id="email-tracking"
                checked={isTrackingEnabled}
                onCheckedChange={(v) => {
                  setIsTrackingEnabled(v);
                  commit({ isTrackingEnabled: v });
                }}
                label="Enable Email Tracking"
                hint="Track when recipients open your emails"
                help="Adds a tracking pixel to your emails to monitor when they are opened. This helps you understand recipient engagement with your campaign."
              />
            </div>
          </div>

          <div>
            <span
              id="active-days-label"
              className="mb-2 flex items-center gap-2 text-sm leading-none font-medium select-none"
            >
              Active Days
            </span>
            <div
              role="group"
              aria-labelledby="active-days-label"
              className="grid grid-cols-3 gap-1.5"
            >
              {daysOfWeek.map((day) => {
                const selected = activeDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    aria-pressed={selected}
                    title={day.label}
                    onClick={() => {
                      const next = selected
                        ? activeDays.filter((id) => id !== day.id)
                        : [...activeDays, day.id];
                      setActiveDays(next);
                      commit({ activeDays: next });
                    }}
                    className={cn(
                      "h-8 rounded-md border px-2 text-xs font-medium transition-colors",
                      "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>

            {activeDays.length === 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                <CalendarIcon className="size-3.5 shrink-0" />
                Select at least one day for this campaign to run.
              </p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
};

export default CampaignSettingsForm;
