"use client";

import { useParams } from "next/navigation";
import { PanelSkeleton } from "@/components/skeletons";
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
    return <PanelSkeleton lines={3} />;
  }

  return (
    <div className="space-y-6">
      {campaignData && <Builder campaign={campaignId} />}
    </div>
  );
}
