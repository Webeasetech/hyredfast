"use client";

import {
  ChartVerticalIcon,
  CalendarIcon,
  UsersIcon,
  EmailIcon,
  EyeIcon,
  MessageSquareIcon,
} from "mage-icons-react/bulk";
import { ArrowUpRightIcon } from "mage-icons-react/stroke";
import useAuthStore from "@/store/auth.store";
import useSWR from "swr";
import fetcher from "@/lib/fetcher";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/page-header";

export default function Dashboard() {
  const { user } = useAuthStore();

  // Use SWR to fetch dashboard stats
  const { data, error, isLoading } = useSWR(
    user?.id ? `/api/dashboard/stats?userId=${user.id}` : null,
    fetcher,
  );

  // Extract data from the SWR response
  const stats = data?.stats || {
    total_contacts: 0,
    total_campaigns: 0,
    emails_sent: 0,
    responses: 0,
  };
  const recentCampaigns = data?.recent_campaigns || [];
  const recentActivities = data?.recent_activities || [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.name || "User"}`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Campaigns"
          value={isLoading ? "..." : stats.total_campaigns}
          icon={ChartVerticalIcon}
          href="/campaigns"
        />
        <StatCard
          title="Total Contacts"
          value={isLoading ? "..." : stats.total_contacts}
          icon={UsersIcon}
          href="/contacts"
        />
        <StatCard
          title="Emails Sent"
          value={isLoading ? "..." : stats.emails_sent}
          icon={EmailIcon}
          href="/emails"
        />
        <StatCard
          title="Responses"
          value={isLoading ? "..." : stats.responses}
          icon={CalendarIcon}
          href="/responses"
        />
      </div>

      {error && (
        <div className="p-4 border border-red-300 bg-red-50 text-red-700 rounded">
          Failed to load dashboard data. Please try again later.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-border bg-white p-6 rounded-lg">
          <h2 className="text-md font-bold mb-4">Recent Campaigns</h2>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-6 w-32 bg-muted animate-pulse rounded"></div>
                  <div className="h-6 w-16 bg-muted animate-pulse rounded"></div>
                </div>
              ))}
            </div>
          ) : recentCampaigns.length > 0 ? (
            <div className="space-y-4">
              {recentCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-medium">{campaign.title}</h3>
                    <p className="text-sm text-foreground">
                      {campaign.emailsSent} emails sent
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{campaign.openRate}%</p>
                    <p className="text-sm text-foreground">Open rate</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No campaigns yet. Create your first campaign!
            </p>
          )}
        </div>

        <div className="border border-border bg-white p-6 rounded-lg">
          <h2 className="text-md font-bold mb-4">Recent Activity</h2>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-muted animate-pulse rounded"></div>
                  <div className="flex-1">
                    <div className="h-5 w-32 bg-muted animate-pulse rounded mb-2"></div>
                    <div className="h-4 w-24 bg-muted animate-pulse rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivities.length > 0 ? (
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <ActivityItem key={index} activity={activity} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No recent activity.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ activity }) {
  // Determine the icon based on activity type
  const getActivityIcon = (type) => {
    if (type.includes("Email sent")) return <EmailIcon className="w-4 h-4" />;
    if (type.includes("Email opened")) return <EyeIcon className="w-4 h-4" />;
    if (type.includes("Reply received"))
      return <MessageSquareIcon className="w-4 h-4" />;
    return <ArrowUpRightIcon className="w-4 h-4" />;
  };

  // Format the timestamp in a user-friendly way
  const formatTimestamp = (timestamp) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      return "recently";
    }
  };

  return (
    <div className="flex items-start space-x-3">
      <div className="w-8 h-8 bg-accent border border-border flex items-center justify-center rounded-lg">
        {getActivityIcon(activity.type)}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className="font-medium">{activity.type}</p>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(activity.timestamp)}
          </span>
        </div>

        {activity.recipientName || activity.recipientEmail ? (
          <p className="text-sm text-foreground">
            {activity.recipientName && activity.recipientEmail
              ? `${activity.recipientName} (${activity.recipientEmail})`
              : activity.recipientName || activity.recipientEmail}
          </p>
        ) : null}

        {activity.campaignTitle && (
          <p className="text-xs text-muted-foreground mt-1">
            Campaign: {activity.campaignTitle}
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, href }) {
  return (
    <div className="border border-border bg-white p-6 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 bg-accent border border-border flex items-center justify-center rounded-lg">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <p className="text-2xl font-bold mt-1">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
      </div>
    </div>
  );
}
