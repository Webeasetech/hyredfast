"use client";

import { useMemo } from "react";

import { EChart } from "@/components/ui/echart";

function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

const DailyAnalysisChart = ({ dailyData }) => {
  const { labels, sent, opened } = useMemo(() => {
    // Already chronological from the API, and today needs no special handling:
    // if anything went out today, that day is a row in this series like any
    // other. Resist appending a separate "Today" point from a campaign-wide
    // total — that is a lifetime cumulative figure, and plotting one against
    // daily values pins the last point to the top of the chart every time.
    const days = Array.isArray(dailyData) ? dailyData : [];

    return {
      labels: days.map((item) => formatDate(item.date)),
      sent: days.map((item) => item.emails_sent || 0),
      opened: days.map((item) => item.opened || 0),
    };
  }, [dailyData]);

  const option = useMemo(
    () => ({
      legend: { data: ["Sent", "Opened"] },
      tooltip: { trigger: "axis" },
      // containLabel already reserves exactly what the axis labels need;
      // the default chrome's extra left/bottom padding was on top of that.
      grid: { top: 28, right: 8, bottom: 4, left: 8 },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: { fontSize: 10, maxRotation: 0 },
      },
      yAxis: { type: "value", minInterval: 1 },
      series: [
        {
          name: "Sent",
          type: "line",
          smooth: true,
          symbolSize: 6,
          areaStyle: { opacity: 0.12 },
          data: sent,
        },
        {
          name: "Opened",
          type: "line",
          smooth: true,
          symbolSize: 6,
          areaStyle: { opacity: 0.12 },
          data: opened,
        },
      ],
    }),
    [labels, sent, opened],
  );

  if (labels.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  return <EChart option={option} className="h-[280px] w-full" />;
};

export default DailyAnalysisChart;
