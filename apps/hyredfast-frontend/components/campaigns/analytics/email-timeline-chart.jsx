"use client";

import { useMemo } from "react";
import { DateTime } from "luxon";

import { EChart } from "@/components/ui/echart";

const DAY_NAMES = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function isActiveDay(date, activeDays) {
  if (!activeDays || !Array.isArray(activeDays) || activeDays.length === 0)
    return true;
  const dayName = DAY_NAMES[date.weekday - 1];
  return activeDays.map((d) => d.toLowerCase()).includes(dayName);
}

function snapToActiveDay(date, activeDays) {
  for (let i = 0; i < 14; i++) {
    const candidate = date.plus({ days: i });
    if (isActiveDay(candidate, activeDays)) return candidate;
  }
  return date;
}

function calculateFutureEmails(contacts, campaign) {
  const today = DateTime.now().startOf("day");
  const futureCounts = {};
  const daysInterval = campaign?.daysInterval || 1;
  const maxStageCount = campaign?.maxStageCount || 1;
  const activeDays = campaign?.activeDays;

  // Total daily capacity = sum of each credential's dailyLimit (default 20 each)
  const creds = campaign?.campaignEmailCredentials || [];
  const totalDailyCapacity =
    creds.length > 0
      ? creds.reduce((sum, c) => sum + (c.emailCredential?.dailyLimit || 20), 0)
      : null;

  (contacts || []).forEach((contact) => {
    if (["COMPLETED", "REPLIED", "BOUNCED"].includes(contact.status)) return;
    const currentStage = contact.stage || 0;
    const remainingStages = maxStageCount - currentStage;
    if (remainingStages <= 0) return;

    let baseDate;
    if (!contact.sentAt) {
      baseDate = snapToActiveDay(today, activeDays);
    } else {
      const lastSent = (
        typeof contact.sentAt === "number"
          ? DateTime.fromMillis(contact.sentAt)
          : DateTime.fromISO(contact.sentAt)
      ).startOf("day");
      const daysSinceLast = Math.floor(today.diff(lastSent, "days").days);
      if (daysSinceLast >= daysInterval) {
        baseDate = snapToActiveDay(today, activeDays);
      } else {
        baseDate = snapToActiveDay(
          today.plus({ days: daysInterval - daysSinceLast }),
          activeDays,
        );
      }
    }

    for (let i = 0; i < remainingStages; i++) {
      const emailDate = snapToActiveDay(
        baseDate.plus({ days: i * daysInterval }),
        activeDays,
      );
      const dateStr = emailDate.toISODate();
      futureCounts[dateStr] = (futureCounts[dateStr] || 0) + 1;
    }
  });

  // Cap each day by totalDailyCapacity and carry overflow to the next active day
  if (totalDailyCapacity) {
    const sortedDates = Object.keys(futureCounts).sort();
    for (let i = 0; i < sortedDates.length; i++) {
      const dateStr = sortedDates[i];
      const count = futureCounts[dateStr] || 0;
      if (count > totalDailyCapacity) {
        futureCounts[dateStr] = totalDailyCapacity;
        const overflow = count - totalDailyCapacity;
        const nextDate = snapToActiveDay(
          DateTime.fromISO(dateStr).plus({ days: 1 }),
          activeDays,
        );
        const nextStr = nextDate.toISODate();
        futureCounts[nextStr] = (futureCounts[nextStr] || 0) + overflow;
        if (!sortedDates.includes(nextStr)) {
          const insertAt = sortedDates.findIndex((d) => d > nextStr);
          sortedDates.splice(
            insertAt === -1 ? sortedDates.length : insertAt,
            0,
            nextStr,
          );
        }
      }
    }
  }

  return futureCounts;
}

const EmailTimelineChart = ({ contacts, campaign, dailyStatsRaw }) => {
  const { rows, totalScheduled } = useMemo(() => {
    const today = DateTime.now().startOf("day");

    const pastMap = {};
    const repliesMap = {};
    (dailyStatsRaw?.stats || []).forEach((row) => {
      pastMap[row.day] = row.sent || 0;
      repliesMap[row.day] = row.replies || 0;
    });

    const futureMap = calculateFutureEmails(contacts, campaign);

    const rows = [];
    for (let offset = 0; offset <= 30; offset++) {
      const date = today.plus({ days: offset });
      const dateStr = date.toISODate();
      const isToday = offset === 0;

      const emails = isToday
        ? (pastMap[dateStr] || 0) + (futureMap[dateStr] || 0)
        : futureMap[dateStr] || 0;
      const replies = isToday ? repliesMap[dateStr] || 0 : 0;

      rows.push({
        label: isToday ? "Today" : date.toFormat("d MMM"),
        emails,
        replies,
      });
    }

    return {
      rows,
      totalScheduled: rows.reduce((sum, r) => sum + r.emails + r.replies, 0),
    };
  }, [contacts, campaign, dailyStatsRaw]);

  // Two series -> a legend is required; the axis carries the dates, so no
  // per-bar labels. The old filler "bg" series is gone: it drew ink that
  // wasn't data just to fake a track behind each bar.
  const option = useMemo(
    () => ({
      legend: { data: ["Scheduled", "Replies"] },
      tooltip: { trigger: "axis" },
      grid: { top: 28, right: 8, bottom: 4, left: 8 },
      xAxis: {
        type: "category",
        data: rows.map((r) => r.label),
        axisLabel: { interval: 4, fontSize: 10 },
      },
      yAxis: { type: "value", minInterval: 1 },
      series: [
        {
          name: "Scheduled",
          type: "bar",
          stack: "total",
          barMaxWidth: 24,
          // Both segments carry the cap: replies are zero on most days, so if
          // only the top series were rounded almost every bar would render
          // square. Whichever segment ends up on top is capped either way.
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          data: rows.map((r) => r.emails),
        },
        {
          name: "Replies",
          type: "bar",
          stack: "total",
          barMaxWidth: 24,
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          data: rows.map((r) => r.replies),
        },
      ],
    }),
    [rows],
  );

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-background p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">Send schedule</h3>
        <span className="text-xs text-muted-foreground">next 30 days</span>
      </div>

      {totalScheduled === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          No emails scheduled
        </div>
      ) : (
        <EChart option={option} className="h-full min-h-[140px] w-full" />
      )}
    </div>
  );
};

export default EmailTimelineChart;
