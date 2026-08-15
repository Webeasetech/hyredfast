"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { toast } from "sonner";
import { SaveFloppyIcon } from "mage-icons-react/bulk";
import { ReloadIcon } from "mage-icons-react/stroke";

import fetcher from "@/lib/fetcher";
import { patch } from "@/lib/apis";
import { PageHeader } from "@/components/page-header";
import { PanelSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import { OptionGrid } from "@/components/onboarding/option-grid";
import {
  SENIORITY,
  EMPLOYMENT_TYPES,
  WORK_MODES,
  URGENCY,
  BLOCKERS,
  ROLE_SUGGESTIONS,
} from "@/lib/constants/onboarding";

const MAX_ROLES = 3;

export default function PreferencesPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Job preferences"
        description="What you told us at signup, changeable any time"
      />
      <Preferences />
    </div>
  );
}

function Preferences() {
  const {
    data,
    isLoading,
    error,
    mutate: refresh,
  } = useSWR("/api/account/preferences", fetcher);

  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!data) return;
    setForm({
      targetRoles: data.targetRoles || [],
      seniority: data.seniority || null,
      employmentTypes: data.employmentTypes || [],
      country: data.country || "",
      city: data.city || "",
      workModes: data.workModes || [],
      willRelocate: data.willRelocate ?? null,
      needsSponsorship: data.needsSponsorship ?? null,
      urgency: data.urgency || null,
      blockers: data.blockers || [],
    });
  }, [data]);

  const { trigger: save, isMutating } = useSWRMutation(
    "/api/account/preferences",
    patch,
    {
      onSuccess: () => {
        toast.success("Preferences updated");
        refresh();
      },
      onError: () => toast.error("Failed to update preferences"),
    },
  );

  if (isLoading || !form) return <PanelSkeleton lines={5} />;

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-white p-6">
        <div className="flex h-40 flex-col items-center justify-center">
          <p className="text-lg text-red-600">Failed to load preferences</p>
          <Button onClick={() => refresh()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const set = (patchValues) => setForm((prev) => ({ ...prev, ...patchValues }));

  const onSave = () =>
    save({
      ...form,
      country: form.country.trim() || null,
      city: form.city.trim() || null,
    });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-bold">Your search</h2>
            <p className="mt-1 text-sm text-foreground">
              These shape who we find for you and how your outreach is written.
            </p>
          </div>
          <Button onClick={onSave} disabled={isMutating} className="shrink-0">
            {isMutating ? (
              <>
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <SaveFloppyIcon className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        <div className="space-y-8 p-6">
          <Section
            label="Roles you're going after"
            hint={`Up to ${MAX_ROLES}.`}
          >
            <OptionGrid
              options={ROLE_SUGGESTIONS}
              value={form.targetRoles}
              onChange={(targetRoles) => set({ targetRoles })}
              multi
              max={MAX_ROLES}
              allowCustom
              customPlaceholder="e.g. Solutions Architect, then press Enter"
            />
          </Section>

          <Section label="Career stage">
            <OptionGrid
              options={SENIORITY}
              value={form.seniority}
              onChange={(seniority) => set({ seniority })}
              columns={3}
            />
          </Section>

          <Section label="Work you're open to">
            <OptionGrid
              options={EMPLOYMENT_TYPES}
              value={form.employmentTypes}
              onChange={(employmentTypes) => set({ employmentTypes })}
              multi
              columns={3}
            />
          </Section>

          <Section label="Where you want to work">
            <div className="space-y-4">
              <OptionGrid
                options={WORK_MODES}
                value={form.workModes}
                onChange={(workModes) => set({ workModes })}
                multi
                columns={3}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={form.city}
                    placeholder="Bengaluru"
                    onChange={(e) => set({ city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={form.country}
                    placeholder="India"
                    onChange={(e) => set({ country: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <YesNoField
                  label="Open to relocating"
                  value={form.willRelocate}
                  onChange={(willRelocate) => set({ willRelocate })}
                />
                <YesNoField
                  label="Needs visa sponsorship"
                  hint="Used to skip companies that can't hire you. Never sent to anyone."
                  value={form.needsSponsorship}
                  onChange={(needsSponsorship) => set({ needsSponsorship })}
                />
              </div>
            </div>
          </Section>

          <Section label="How the search is going">
            <OptionGrid
              options={URGENCY}
              value={form.urgency}
              onChange={(urgency) => set({ urgency })}
            />
          </Section>

          <Section label="Hardest part right now">
            <OptionGrid
              options={BLOCKERS}
              value={form.blockers}
              onChange={(blockers) => set({ blockers })}
              multi
              columns={1}
            />
          </Section>
        </div>
      </div>

      <ResumePanel data={data} />
    </div>
  );
}

function Section({ label, hint, children }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function YesNoField({ label, hint, value, onChange }) {
  return (
    <div className="space-y-2">
      <div>
        <Label>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex gap-2">
        {[
          { text: "Yes", answer: true },
          { text: "No", answer: false },
        ].map((option) => (
          <Button
            key={option.text}
            type="button"
            variant={value === option.answer ? "default" : "outline"}
            size="sm"
            className="min-w-16"
            onClick={() => onChange(value === option.answer ? null : option.answer)}
          >
            {option.text}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * Read-only on purpose. Re-uploading a résumé belongs with the résumé agent,
 * not here — this panel exists so users can see what we actually kept off the
 * file they gave us at signup, and confirm the file itself is not stored.
 */
function ResumePanel({ data }) {
  const parsed = data?.resumeParsed;

  return (
    <div className="rounded-lg border border-border bg-white">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-xl font-bold">From your résumé</h2>
        <p className="mt-1 text-sm text-foreground">
          We read your résumé once at signup and discarded the file. This is
          everything we kept.
        </p>
      </div>

      <div className="p-6">
        {parsed ? (
          <dl className="space-y-3 text-sm">
            {parsed.headline && <Row label="Title" value={parsed.headline} />}
            {parsed.yearsOfExperience > 0 && (
              <Row
                label="Experience"
                value={`${parsed.yearsOfExperience} years`}
              />
            )}
            {parsed.companies?.length > 0 && (
              <Row label="Worked at" value={parsed.companies.join(", ")} />
            )}
            {parsed.skills?.length > 0 && (
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 text-muted-foreground">Skills</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {parsed.skills.map((skill) => (
                    <Chip key={skill} variant="muted" size="sm">
                      {skill}
                    </Chip>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            No résumé was uploaded during signup.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">{value}</dd>
    </div>
  );
}
