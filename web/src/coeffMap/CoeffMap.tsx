import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { MapChart } from 'echarts/charts';
import {
  TooltipComponent,
  VisualMapComponent,
  GeoComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';

import { colorForCoef, computeDomain } from './colorScale';
import { Legend } from './Legend';
import { getCoef, toReferencePlaceBase } from './scale';
import {
  COEF_FIELD,
  DEFAULT_THEME,
  INDEX_LABEL,
  RAW_FIELD,
  type CoeffMapProps,
  type CoeffRecord,
} from './types';
import { useFilteredCoeffData } from './useCoeffData';
import { coefficientVintage, formatLocationLabel } from './vintage';

echarts.use([
  MapChart,
  TooltipComponent,
  VisualMapComponent,
  GeoComponent,
  CanvasRenderer,
]);

function featureId(f: GeoJSON.Feature): string {
  return String(
    f.id ?? (f.properties as { geoid?: string } | null)?.geoid ?? '',
  );
}

function valueOf(
  rec: CoeffRecord | undefined,
  index: CoeffMapProps['index'],
  metric: NonNullable<CoeffMapProps['metric']>,
): number | null {
  if (!rec) return null;
  const field = metric === 'raw' ? RAW_FIELD[index] : COEF_FIELD[index];
  const v = rec[field];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function CoeffMap({
  grain,
  index,
  metric = 'coef',
  focusRegion = null,
  baselineGeoid = null,
  onSelect,
  height = 480,
  theme,
  showLegend = true,
  className,
}: CoeffMapProps) {
  const t = { ...DEFAULT_THEME, ...theme };
  const { data, geo, loading, error, meta } = useFilteredCoeffData(
    grain,
    focusRegion,
  );
  const chartRef = useRef<HTMLDivElement>(null);
  const mapName = `coeff-${grain}`;
  const [mapReady, setMapReady] = useState(false);

  // Register GeoJSON with ECharts whenever grain/geo changes
  useEffect(() => {
    setMapReady(false);
    if (!geo) return;
    echarts.registerMap(
      mapName,
      geo as unknown as Parameters<typeof echarts.registerMap>[1],
    );
    setMapReady(true);
  }, [geo, mapName]);

  const seriesData = useMemo(() => {
    if (!geo || !data) return [] as Array<{
      name: string;
      value: number | null;
      record: CoeffRecord | undefined;
    }>;
    return geo.features.map((f: GeoJSON.Feature) => {
      const id = featureId(f);
      const rec = data[id];
      let v = valueOf(rec, index, metric);
      // Optional visual rebase when metric is coef and baseline set
      if (
        metric === 'coef' &&
        v != null &&
        baselineGeoid &&
        data[baselineGeoid]
      ) {
        const base = getCoef(data[baselineGeoid], index);
        if (base != null && base !== 0) {
          v = toReferencePlaceBase(v, base);
        }
      }
      return {
        name: id,
        value: v,
        record: rec,
      };
    });
  }, [geo, data, index, metric, baselineGeoid]);

  const domain = useMemo(() => {
    const vals = seriesData
      .map((d: { value: number | null }) => d.value)
      .filter((v: number | null): v is number => v != null && Number.isFinite(v));
    // For coef metric always center on 1; for raw use data-driven
    if (metric === 'coef') return computeDomain(vals.length ? vals : [1]);
    if (!vals.length) return computeDomain([1]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    // Fake a domain around midpoint so colorForCoef still works; legend notes raw
    const mid = (min + max) / 2 || 1;
    return {
      lo: min,
      hi: max,
      min,
      max,
      // colorForCoef expects center at 1 — for raw we remap below
      _mid: mid,
    } as ReturnType<typeof computeDomain> & { _mid?: number };
  }, [seriesData, metric]);

  const pieces = useMemo(() => {
    // Build visualMap pieces using our teal/copper scale for coef mode
    const stops: { gt?: number; gte?: number; lt?: number; lte?: number; color: string }[] = [];
    if (metric !== 'coef') {
      // continuous raw — approximate with 6 bins
      const { lo, hi } = domain;
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a = lo + ((hi - lo) * i) / n;
        const b = lo + ((hi - lo) * (i + 1)) / n;
        const tNorm = i / (n - 1);
        const color =
          tNorm < 0.5
            ? colorForCoef(0.85 + tNorm, { lo: 0.7, hi: 1.3, min: 0.7, max: 1.3 }, t)
            : colorForCoef(1 + (tNorm - 0.5), { lo: 0.7, hi: 1.3, min: 0.7, max: 1.3 }, t);
        stops.push({ gte: a, lt: i === n - 1 ? undefined : b, lte: i === n - 1 ? b : undefined, color });
      }
      return stops;
    }
    const n = 10;
    for (let i = 0; i < n; i++) {
      const tNorm = i / n;
      const a =
        tNorm < 0.5
          ? domain.lo + (1 - domain.lo) * (tNorm / 0.5)
          : 1 + (domain.hi - 1) * ((tNorm - 0.5) / 0.5);
      const tNext = (i + 1) / n;
      const b =
        tNext < 0.5
          ? domain.lo + (1 - domain.lo) * (tNext / 0.5)
          : 1 + (domain.hi - 1) * ((tNext - 0.5) / 0.5);
      const mid = (a + b) / 2;
      stops.push({
        gte: a,
        lt: i === n - 1 ? undefined : b,
        lte: i === n - 1 ? b : undefined,
        color: colorForCoef(mid, domain, t),
      });
    }
    return stops;
  }, [domain, metric, t]);

  const option: EChartsOption = useMemo(() => {
    if (!geo || !mapReady) {
      return {
        backgroundColor: t.background,
        title: {
          text: loading ? 'Loading map…' : error || 'No geography',
          left: 'center',
          top: 'middle',
          textStyle: { color: t.muted, fontFamily: t.fontFamily, fontSize: 14 },
        },
      };
    }

    return {
      backgroundColor: t.background,
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172aee',
        borderWidth: 0,
        textStyle: { color: '#f8fafc', fontFamily: t.fontFamily, fontSize: 12 },
        formatter: (params: unknown) => {
          const p = params as {
            name?: string;
            value?: number | null;
            data?: { record?: CoeffRecord; value?: number | null };
          };
          const rec = p.data?.record;
          const vintage = coefficientVintage(meta, grain, index);
          const label = formatLocationLabel(rec, vintage, p.name ?? '');
          const v = p.data?.value ?? p.value;
          const vStr =
            v == null || !Number.isFinite(v)
              ? '—'
              : metric === 'coef'
                ? Number(v).toFixed(3)
                : String(v);
          const pop =
            rec?.population != null
              ? `<div style="color:#94a3b8">Pop ${rec.population.toLocaleString()}</div>`
              : '';
          return `<div style="min-width:160px"><div style="font-weight:600">${label}</div><div>${INDEX_LABEL[index]}: <b>${vStr}</b></div>${pop}</div>`;
        },
      },
      series: [
        {
          name: INDEX_LABEL[index],
          type: 'map',
          map: mapName,
          roam: true,
          nameProperty: 'geoid',
          itemStyle: {
            borderColor: t.stroke,
            borderWidth: grain === 'place' ? 0.4 : 0.6,
            areaColor: t.missing,
          },
          emphasis: {
            itemStyle: {
              borderColor: '#f8fafc',
              borderWidth: 1.2,
              areaColor: undefined,
            },
            label: { show: false },
          },
          select: {
            itemStyle: {
              borderColor: '#fbbf24',
              borderWidth: 1.5,
            },
          },
          data: seriesData.map((d: { name: string; value: number | null; record: CoeffRecord | undefined }) => ({
            name: d.name,
            value: d.value ?? undefined,
            record: d.record,
            itemStyle:
              d.value == null
                ? { areaColor: t.missing }
                : undefined,
          })),
        },
      ],
      visualMap: {
        show: false,
        type: 'piecewise',
        pieces,
        seriesIndex: 0,
        outOfRange: { color: t.missing },
      },
    };
  }, [
    geo,
    mapReady,
    mapName,
    loading,
    error,
    t,
    index,
    metric,
    grain,
    meta,
    seriesData,
    pieces,
  ]);

  useEffect(() => {
    const container = chartRef.current;
    if (!container) return;
    const chart = echarts.getInstanceByDom(container) ?? echarts.init(container);
    chart.setOption(option, { notMerge: true, lazyUpdate: true });
    const onClick = (params: unknown) => {
      if (!onSelect) return;
      const p = params as { data?: { record?: CoeffRecord; name?: string } };
      const rec = p.data?.record ?? null;
      const id = p.data?.name ?? rec?.geoid ?? null;
      onSelect(rec, id);
    };
    chart.on('click', onClick);
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
      chart.off('click', onClick);
    };
  }, [option, onSelect]);

  useEffect(() => () => {
    const container = chartRef.current;
    if (container) echarts.getInstanceByDom(container)?.dispose();
  }, []);

  const heightCss = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: heightCss,
        background: t.background,
        borderRadius: 12,
        overflow: 'hidden',
        fontFamily: t.fontFamily,
      }}
    >
      <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
      {showLegend && mapReady && !loading && !error && metric === 'coef' && (
        <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 2 }}>
          <Legend
            domain={domain}
            index={index}
            theme={t}
            subtitle={
              baselineGeoid
                ? `1.00 = baseline ${baselineGeoid}`
                : '1.00 = median metro'
            }
          />
        </div>
      )}
      {meta && (
        <div
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            zIndex: 2,
            color: t.muted,
            fontSize: 10,
            maxWidth: 220,
            textAlign: 'right',
            pointerEvents: 'none',
          }}
        >
          {grain === 'county' && 'County: OUSEA experimental'}
          {grain === 'place' && 'Place: rent-scaled proxy'}
          {grain === 'metro' && 'Metro: BEA MARPP 2024'}
        </div>
      )}
    </div>
  );
}

export default CoeffMap;
