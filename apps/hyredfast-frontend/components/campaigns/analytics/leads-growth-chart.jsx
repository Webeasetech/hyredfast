"use client";

import { useState, useEffect, useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin,
);

function formatDate(dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  return `${day}-${month}-${year.slice(-2)}`;
}

/**
 * Chart.js paints to a canvas, so it cannot use Tailwind classes or raw
 * `var(--token)` strings — it needs resolved colours. Read the design system's
 * HSL triplets off :root once on mount and build real `hsl()` strings, so the
 * chart stays tied to the theme tokens instead of hardcoding hexes that drift
 * the next time the palette moves.
 */
function readThemeColors() {
  const root = getComputedStyle(document.documentElement);
  const token = (name, alpha) => {
    const triplet = root.getPropertyValue(name).trim();
    if (!triplet) return undefined;
    return alpha === undefined
      ? `hsl(${triplet})`
      : `hsl(${triplet} / ${alpha})`;
  };

  return {
    primary: token("--primary"),
    primaryFill: token("--primary", 0.85),
    muted: token("--muted-foreground"),
    mutedFill: token("--muted-foreground", 0.12),
    // The average line is a reference, not a series — give it the second chart
    // accent so it stays legible against the now primary-coloured bars.
    accent: token("--chart-2"),
    accentFill: token("--chart-2", 0.9),
    grid: token("--border"),
  };
}

const LeadsGrowthChart = ({ growthData }) => {
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [],
  });
  const [avgPerDay, setAvgPerDay] = useState(0);
  // Read once, lazily. :root custom properties don't exist during SSR, so this
  // stays null on the server and resolves on the client's first render — the
  // markup is identical either way, since the datasets only populate below.
  const [colors] = useState(() =>
    typeof document === "undefined" ? null : readThemeColors(),
  );

  useEffect(() => {
    if (!growthData?.data || growthData.data.length === 0) return;
    if (!colors) return;

    const labels = growthData.data.map((item) => formatDate(item.date));
    const counts = growthData.data.map((item) => item.count);

    // Compute cumulative totals
    const cumulative = [];
    counts.reduce((acc, val, i) => {
      cumulative[i] = acc + val;
      return cumulative[i];
    }, 0);

    // Compute average per day
    const avg =
      counts.length > 0
        ? counts.reduce((sum, c) => sum + c, 0) / counts.length
        : 0;

    setAvgPerDay(avg);

    setChartData({
      labels,
      datasets: [
        {
          label: "Leads Added",
          data: counts,
          backgroundColor: colors.primaryFill,
          borderColor: colors.primary,
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: "Cumulative Total",
          data: cumulative,
          type: "line",
          borderColor: colors.muted,
          backgroundColor: colors.mutedFill,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: colors.muted,
          borderWidth: 2,
        },
      ],
    });
  }, [growthData, colors]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: {
            boxWidth: 15,
            usePointStyle: true,
            pointStyle: "circle",
          },
        },
        tooltip: {
          callbacks: {
            title: (items) => items[0]?.label || "",
          },
        },
        annotation: {
          annotations: {
            avgLine: {
              type: "line",
              yMin: avgPerDay,
              yMax: avgPerDay,
              borderColor: colors?.accent,
              borderWidth: 2,
              borderDash: [6, 4],
              label: {
                display: true,
                content: `Avg: ${avgPerDay.toFixed(1)} / day`,
                position: "end",
                backgroundColor: colors?.accentFill,
                color: "#fff",
                font: { size: 11, weight: "bold" },
                padding: { top: 3, bottom: 3, left: 6, right: 6 },
                borderRadius: 4,
              },
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: colors?.grid,
          },
          ticks: {
            precision: 0,
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
    }),
    [avgPerDay, colors],
  );

  return (
    <div className="h-[300px] w-full">
      {chartData.labels.length > 0 ? (
        <Bar data={chartData} options={options} />
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">No leads data available</p>
        </div>
      )}
    </div>
  );
};

export default LeadsGrowthChart;
