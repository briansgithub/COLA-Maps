import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import type { EChartsCoreOption } from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  DataZoomComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

export interface ChartLine {
  key: string;
  label: string;
  values: Array<number | null>;
  color?: string;
  width?: number;
}

interface Props {
  months: string[];
  lines: ChartLine[];
  height?: number;
  zoom?: boolean;
  compact?: boolean;
  markers?: Array<{ month: string; label: string }>;
}

const COLORS = ["#2563eb", "#c2410c", "#0f766e", "#7c3aed", "#b45309", "#0369a1", "#475569"];

export function TimeSeriesChart({
  months,
  lines,
  height = 410,
  zoom = false,
  compact = false,
  markers = [],
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const series = lines.map((line, index) => ({
    name: line.label,
    type: "line",
    data: line.values,
    showSymbol: false,
    connectNulls: false,
    animationDuration: 650,
    sampling: "lttb",
    lineStyle: {
      width: line.width ?? (index === 0 ? 3 : 2),
      color: line.color ?? COLORS[index % COLORS.length],
    },
    itemStyle: { color: line.color ?? COLORS[index % COLORS.length] },
    emphasis: { focus: "series", lineStyle: { width: 4 } },
    markLine: markers.length
      ? {
          silent: true,
          symbol: "none",
          label: { formatter: "{b}", color: "#475569", fontSize: 11, fontFamily: "IBM Plex Mono" },
          lineStyle: { color: "#94a3b8", type: "dashed", width: 1 },
          data: markers.map((marker) => ({ xAxis: marker.month, name: marker.label })),
        }
      : undefined,
  }));

  const option: EChartsCoreOption = {
    color: COLORS,
    animation: true,
    grid: {
      left: compact ? 6 : 52,
      right: compact ? 8 : 24,
      top: compact ? 10 : 38,
      bottom: zoom ? 74 : compact ? 8 : 44,
      containLabel: compact,
    },
    legend: compact
      ? undefined
      : {
          type: "scroll",
          top: 0,
          left: 0,
          right: 0,
          textStyle: { color: "#334155", fontFamily: "IBM Plex Sans" },
        },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value: unknown) => (typeof value === "number" ? `${value.toFixed(3)}×` : "—"),
      backgroundColor: "rgba(15, 23, 42, .94)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontFamily: "IBM Plex Mono" },
    },
    xAxis: {
      type: "category",
      data: months,
      boundaryGap: false,
      axisLabel: compact
        ? { show: false }
        : {
            color: "#64748b",
            fontFamily: "IBM Plex Mono",
            formatter: (value: string) => (value.endsWith("-01") ? value.slice(0, 4) : ""),
            hideOverlap: true,
          },
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      scale: !compact,
      axisLabel: compact
        ? { show: false }
        : { color: "#64748b", fontFamily: "IBM Plex Mono", formatter: "{value}×" },
      splitLine: { show: !compact, lineStyle: { color: "#e2e8f0", type: "dashed" } },
    },
    dataZoom: zoom
      ? [
          { type: "inside", zoomOnMouseWheel: "shift", moveOnMouseWheel: true },
          {
            type: "slider",
            height: 22,
            bottom: 10,
            borderColor: "transparent",
            fillerColor: "rgba(37, 99, 235, .14)",
            backgroundColor: "#e2e8f0",
            handleStyle: { color: "#2563eb", borderColor: "#2563eb" },
          },
        ]
      : undefined,
    series,
  };

  useEffect(() => {
    if (!container.current) return;
    const chart = echarts.init(container.current, undefined, { renderer: "canvas" });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, []);

  useEffect(() => {
    const chart = container.current && echarts.getInstanceByDom(container.current);
    chart?.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [option]);

  return <div ref={container} style={{ height, width: "100%" }} />;
}
