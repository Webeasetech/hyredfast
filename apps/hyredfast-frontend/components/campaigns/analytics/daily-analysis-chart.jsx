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

const DailyAnalysisChart = ({ dailyData, todayData }) => {
  const { labels, sent, opened } = useMemo(() => {
    const days = Array.isArray(dailyData) ? dailyData : [];

    const labels = days.map((item) => formatDate(item.date));
    const sent = days.map((item) => item.emails_sent || 0);
    const opened = days.map((item) => item.opened || 0);

    // The axios response interceptor already unwraps response.data, so the
    // today-analysis payload lands here flat — { stages_sum, opened_sum,
    // total } — not nested under another `.data`.
    if (todayData) {
      labels.push("Today");
      sent.push(todayData.stages_sum ?? 0);
      opened.push(todayData.opened_sum ?? 0);
    }

    return { labels, sent, opened };
  }, [dailyData, todayData]);

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
