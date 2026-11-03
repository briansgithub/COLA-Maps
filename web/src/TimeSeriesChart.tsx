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

const COLORS = ["#167f77", "#d07a36", "#315d87", "#9c4f42", "#6f7f43", "#7c6394", "#457b69"];

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
          label: { formatter: "{b}", color: "#36555b", fontSize: 11 },
          lineStyle: { color: "#6c898d", type: "dashed", width: 1 },
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
          textStyle: { color: "#304e55", fontFamily: "IBM Plex Sans" },
        },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value: unknown) => (typeof value === "number" ? `${value.toFixed(3)}×` : "—"),
      backgroundColor: "rgba(8, 35, 41, .94)",
      borderWidth: 0,
      textStyle: { color: "#f5faf8", fontFamily: "IBM Plex Sans" },
    },
    xAxis: {
      type: "category",
      data: months,
      boundaryGap: false,
      axisLabel: compact
        ? { show: false }
        : {
            color: "#61777b",
            formatter: (value: string) => (value.endsWith("-01") ? value.slice(0, 4) : ""),
            hideOverlap: true,
          },
      axisLine: { lineStyle: { color: "#b9c9c7" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      scale: !compact,
      axisLabel: compact ? { show: false } : { color: "#61777b", formatter: "{value}×" },
      splitLine: { show: !compact, lineStyle: { color: "#dce6e3", type: "dashed" } },
    },
    dataZoom: zoom
      ? [
          { type: "inside", zoomOnMouseWheel: "shift", moveOnMouseWheel: true },
          {
            type: "slider",
            height: 24,
            bottom: 12,
            borderColor: "transparent",
            fillerColor: "rgba(22, 127, 119, .16)",
            backgroundColor: "#dfeae7",
            handleStyle: { color: "#167f77", borderColor: "#167f77" },
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
