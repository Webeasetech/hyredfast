"use client";

import { useParams, useRouter } from "next/navigation";
import LeadComposer from "@/components/campaigns/lead-composer/lead-composer";

/**
 * The lead sheet, on its own URL.
 *
 * It was a full-screen dialog, which meant it had no address: a reload landed
 * back on the campaign, and there was no link to send anyone. A draft that
 * outlives a logout deserves somewhere to live, so this is a route.
 *
 * The campaign's tab bar stands aside for it (see the campaign layout) — the
 * sheet wants the height, and none of those tabs is the page you are on.
 */
export default function ImportLeadsPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id;

  return (
    <LeadComposer
      campaignId={campaignId}
      onCommitted={() => router.push(`/campaigns/${campaignId}`)}
    />
  );
}
