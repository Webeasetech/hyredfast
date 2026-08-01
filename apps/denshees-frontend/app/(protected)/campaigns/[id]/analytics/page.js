"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import fetcher from "@/lib/fetcher";
import AnalyticsDashboard from "@/components/campaigns/analytics/analytics-dashboard";

export default function CampaignAnalyticsPage() {
  const params = useParams();
  const campaignId = params.id;

  const { data: campaignData, isLoading: campaignLoading } = useSWR(
    campaignId ? `/api/campaign/${campaignId}` : null,
    fetcher,
  );

  if (campaignLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="border border-border p-4">
          <p className="text-lg font-medium">Loading campaign analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnalyticsDashboard campaignId={campaignId} campaign={campaignData} />
    </div>
  );
}
