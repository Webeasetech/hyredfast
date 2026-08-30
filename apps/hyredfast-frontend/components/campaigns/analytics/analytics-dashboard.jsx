"use client";

import useSWR from "swr";
import { CardsSkeleton, ChartSkeleton } from "@/components/skeletons";
import fetcher from "@/lib/fetcher";
import StatCard from "@/components/campaigns/analytics/stat-card";
import EmailTimelineChart from "@/components/campaigns/analytics/email-timeline-chart";
import DailyAnalysisChart from "@/components/campaigns/analytics/daily-analysis-chart";
import MessageInbox from "@/components/campaigns/analytics/message-inbox";
import {
  EmailIcon,
  CheckCircleIcon,
  AeroplaneIcon,
  EyeIcon,
  MessageSquareIcon,
} from "mage-icons-react/bulk";
import PieChart from "@/components/campaigns/analytics/pie-chart";
import { ACTIVE_LEAD_STATUSES } from "@/lib/constants/lead-status";
import { CampaignActivities } from "./recent-activities";

const AnalyticsDashboard = ({ campaignId, campaign }) => {
  // Fetch campaign contacts
  const { data: contactsData, isLoading: contactsLoading } = useSWR(
    campaignId ? `/api/contacts?campaign=${campaignId}` : null,
    fetcher,
  );

  // Fetch daily stats data
  const { data: dailyStatsRaw, isLoading: dailyAnalysisLoading } = useSWR(
    campaignId ? `/api/analysis/campaign/${campaignId}/daily-stats` : null,
    fetcher,
  );

  // Transform daily-stats shape to match what DailyAnalysisChart expects
  const dailyAnalysisData = dailyStatsRaw?.stats?.map((row) => ({
    date: row.day,
    opened: row.opens,
    emails_sent: row.sent,
  }));

  if (contactsLoading || dailyAnalysisLoading) {
    return (
      <div className="space-y-4">
        <CardsSkeleton count={5} className="lg:grid-cols-5" />
        <ChartSkeleton />
      </div>
    );
  }

  // Calculate stats from data
  const contacts = contactsData || [];
  const totalContacts = contacts.length;
  const activeContacts = contacts.filter((c) =>
    ACTIVE_LEAD_STATUSES.includes(c.status),
  ).length;
  const verifiedContacts = contacts.filter(
    (c) => c.verified === "VERIFIED",
  ).length;
  const emailsSent = contacts.reduce(
    (sum, contact) => sum + (contact.stage || 0),
    0,
  );
  const emailsOpened = contacts.filter((c) => c.openCount > 0).length;
  const emailsReplied = contacts.filter((c) => c.status === "REPLIED").length;

  // Calculate completion percentage
  const maxPossibleEmails = totalContacts * (campaign?.maxStageCount || 1);
  const completionPercentage =
    maxPossibleEmails > 0 ? (emailsSent / maxPossibleEmails) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Stats Cards — one connected strip, cells separated by a divider
          instead of five isolated cards with gaps between them. Stacks to a
          column with horizontal dividers below sm; a row of 5 never wraps,
          so the divider math (border only between DOM siblings) stays
          correct at every width. */}
      <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-white sm:flex-row sm:divide-x sm:divide-y-0">
        <StatCard
          title="Active Leads"
          value={
            <>
              {activeContacts}
              <span className="text-muted-foreground"> / {totalContacts}</span>
            </>
          }
          icon={<EmailIcon className="size-4" />}
        />
        <StatCard
          title="Verified"
          value={verifiedContacts}
          icon={<CheckCircleIcon className="size-4" />}
        />
        <StatCard
          title="Emails Sent"
          value={emailsSent}
          icon={<AeroplaneIcon className="size-4" />}
        />
        <StatCard
          title="Emails Opened"
          value={emailsOpened}
          icon={<EyeIcon className="size-4" />}
        />
        <StatCard
          title="Replies"
          value={emailsReplied}
          icon={<MessageSquareIcon className="size-4" />}
        />
      </div>

      {/* Email send / schedule timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch min-h-[140px]">
        <div className="lg:col-span-4 h-full">
          <EmailTimelineChart
            contacts={contacts}
            campaign={campaign}
            dailyStatsRaw={dailyStatsRaw}
          />
        </div>
        {/* No label, no bar — the number carries the whole card. Three
            layered gradients (a directional wash plus a light and a dark
            pool) stand in for a single flat fill. The grain is a real paper
            texture (public/paper.svg) multiplied over the gradient. The scan
            itself is almost uniformly pale (RGB ~150-196, nothing darker),
            so it's contrast-boosted first — otherwise multiply has nearly
            nothing to darken and the texture is invisible — then masked to a
            radial patch so it still reads as a worn corner, not a filter
            over everything. */}
        <div
          className="relative flex items-center justify-center overflow-hidden rounded-lg"
          style={{
            backgroundImage: [
              "radial-gradient(circle at 22% 18%, hsl(var(--primary-foreground) / 0.35), transparent 42%)",
              "radial-gradient(circle at 82% 88%, hsl(0 0% 0% / 0.35), transparent 50%)",
              "linear-gradient(135deg, hsl(var(--primary) / 1) 0%, hsl(var(--primary) / 0.82) 35%, hsl(var(--primary) / 0.95) 60%, hsl(var(--primary) / 0.7) 100%)",
            ].join(", "),
          }}
          title="Campaign progress"
        >
          <div
            className="pointer-events-none absolute inset-0 mix-blend-multiply"
            style={{
              backgroundImage: "url(/paper.svg)",
              backgroundSize: "48px 48px",
              backgroundRepeat: "repeat",
              filter: "contrast(6) brightness(1.3)",
              maskImage:
                "radial-gradient(circle at 72% 78%, black 0%, black 35%, transparent 75%)",
              WebkitMaskImage:
                "radial-gradient(circle at 72% 78%, black 0%, black 35%, transparent 75%)",
            }}
          />
          <span className="relative text-7xl font-bold tabular-nums text-primary-foreground">
            {Math.round(completionPercentage)}%
          </span>
        </div>
      </div>

      {/* Charts and Inbox */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border bg-background p-4">
          <h3 className="mb-3 text-sm font-medium">Daily Activity</h3>

          {totalContacts > 0 ? (
            <DailyAnalysisChart dailyData={dailyAnalysisData} />
          ) : (
            <p className="text-center py-12 text-muted-foreground">
              Add leads to this campaign to see daily progress.
            </p>
          )}
        </div>

        <MessageInbox campaignId={campaignId} />
      </div>

      <CampaignActivities campaignId={campaignId} />
    </div>
  );
};

export default AnalyticsDashboard;
