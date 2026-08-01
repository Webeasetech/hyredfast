"use client";

import * as React from "react";
import * as echarts from "echarts";

import { cn } from "@/lib/utils";

// Tokens live in globals.css as bare HSL triplets ("210 90.2% 40%"), so they can
// be composed with alpha by Tailwind. ECharts needs a real color string.
function token(styles, name, fallback) {
  const value = styles.getPropertyValue(name).trim();
  return value ? `hsl(${value})` : fallback;
}

/**
 * Resolves the chart palette + chrome from the design tokens currently in
 * effect. Read from the live element so a theme change is picked up on the next
 * render instead of being baked in at module load.
 */
export function readChartTokens(el) {
  const styles = getComputedStyle(el);
  return {
    series: [
      token(styles, "--chart-1", "#0a66c2"),
      token(styles, "--chart-2", "#eb6834"),
      token(styles, "--chart-3", "#1baf7a"),
      token(styles, "--chart-4", "#eda100"),
      token(styles, "--chart-5", "#e87ba4"),
    ],
    surface: token(styles, "--background", "#ffffff"),
    ink: token(styles, "--foreground", "#0b0b0b"),
    muted: token(styles, "--muted-foreground", "#898781"),
    border: token(styles, "--border", "#e1e0d9"),
  };
}

/**
 * Shared chart chrome. Everything recessive lives here so individual charts only
 * describe their data — grid and axes are hairline and one step off the surface,
 * label text wears text tokens rather than the series color, and lines/markers
 * carry the fixed mark specs (2px stroke, >=8px symbol).
 */
function baseOption(t) {
  return {
    color: t.series,
    textStyle: { fontFamily: "var(--font-dm-sans), system-ui, sans-serif" },
    grid: { top: 28, right: 16, bottom: 24, left: 44, containLabel: true },
    legend: {
      top: 0,
      left: 0,
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 16,
      textStyle: { color: t.muted, fontSize: 12 },
    },
    tooltip: {
      backgroundColor: t.surface,
      borderColor: t.border,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { color: t.ink, fontSize: 12 },
      axisPointer: { lineStyle: { color: t.border, width: 1 } },
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: t.border } },
      axisTick: { show: false },
      axisLabel: { color: t.muted, fontSize: 11 },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: t.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: t.border, width: 1, type: "solid" } },
    },
  };
}

/** Applies the shared axis chrome to whichever axes the caller declared. */
function withAxisDefaults(option, base) {
  const merge = (axis) => {
    if (!axis) return axis;
    const list = Array.isArray(axis) ? axis : [axis];
    return list.map((a) => ({
      ...(a.type === "value" ? base.valueAxis : base.categoryAxis),
      ...a,
    }));
  };
  return { ...option, xAxis: merge(option.xAxis), yAxis: merge(option.yAxis) };
}

/**
 * Thin ECharts wrapper: one instance per mount, options re-applied on change,
 * and a ResizeObserver so it reflows inside responsive layouts.
 */
export function EChart({ option, className, style, ...props }) {
  const containerRef = React.useRef(null);
  const chartRef = React.useRef(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = echarts.init(el, null, { renderer: "svg" });
    chartRef.current = chart;

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const chart = chartRef.current;
    const el = containerRef.current;
    if (!chart || !el || !option) return;

    const base = baseOption(readChartTokens(el));
    const { categoryAxis, valueAxis, ...chrome } = base;

    chart.setOption(
      withAxisDefaults(
        {
          ...chrome,
          ...option,
          legend: option.legend
            ? { ...chrome.legend, ...option.legend }
            : { show: false },
          tooltip: { ...chrome.tooltip, ...option.tooltip },
          grid: { ...chrome.grid, ...option.grid },
        },
        base,
      ),
      { notMerge: true },
    );
  }, [option]);

  return (
    <div
      ref={containerRef}
      className={cn("h-64 w-full", className)}
      style={style}
      {...props}
    />
  );
}
