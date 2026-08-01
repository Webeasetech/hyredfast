"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import fetcher from "@/lib/fetcher";
import Builder from "@/components/campaigns/builder/builder";
import LeadFinderChat from "@/components/lead-finder-chat";

export default function CampaignBuilderPage() {
  const params = useParams();
  const campaignId = params.id;

  const { data: campaignData, isLoading } = useSWR(
    campaignId ? `/api/campaign/${campaignId}` : null,
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="border border-border bg-white p-6 flex items-center justify-center h-[400px] rounded-lg">
        <div className="border border-border p-4">
          <p className="text-lg font-medium">Loading campaign templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {campaignData && <Builder campaign={campaignId} />}
    </div>
  );
}
