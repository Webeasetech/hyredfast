"use client";

import { useParams } from "next/navigation";
import { ChartSkeleton } from "@/components/skeletons";
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
    return <ChartSkeleton />;
  }

  return (
    <div className="space-y-6">
      <AnalyticsDashboard campaignId={campaignId} campaign={campaignData} />
    </div>
  );
}
