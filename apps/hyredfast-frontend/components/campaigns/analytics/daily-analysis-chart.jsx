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
    // Already chronological from the API. Today needs no special handling —
    // if anything was sent today, the day is a row in this series like any
    // other. A separate "Today" point used to be appended here from
    // today_analysis, but that endpoint returns lifetime totals (the sum of
    // every lead's stage), so it plotted a cumulative figure against daily
    // ones and always spiked to the top of the chart.
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
