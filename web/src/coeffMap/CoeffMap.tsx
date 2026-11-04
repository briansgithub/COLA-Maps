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

const SERIES_ID = 'coeff-series';

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

function featureCentroid(feature: GeoJSON.Feature | undefined): [number, number] | null {
  if (!feature?.geometry) return null;
  const rings: number[][][] = [];
  if (feature.geometry.type === 'Polygon') {
    rings.push(feature.geometry.coordinates[0] as number[][]);
  } else if (feature.geometry.type === 'MultiPolygon') {
    for (const poly of feature.geometry.coordinates) {
      rings.push(poly[0] as number[][]);
    }
  } else {
    return null;
  }
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const ring of rings) {
    for (const pt of ring) {
      if (typeof pt[0] === 'number' && typeof pt[1] === 'number') {
        sx += pt[0];
        sy += pt[1];
        n += 1;
      }
    }
  }
  return n ? [sx / n, sy / n] : null;
}

function coordsFor(
  rec: CoeffRecord | undefined,
  geo: GeoJSON.FeatureCollection,
  geoid: string,
): [number, number] | null {
  if (
    rec &&
    typeof rec.lon === 'number' &&
    typeof rec.lat === 'number' &&
    Number.isFinite(rec.lon) &&
    Number.isFinite(rec.lat)
  ) {
    return [rec.lon, rec.lat];
  }
  const feature = geo.features.find((f) => featureId(f) === geoid);
  return featureCentroid(feature);
}

function flyZoom(grain: CoeffMapProps['grain']): number {
  if (grain === 'place') return 8;
  if (grain === 'county') return 5.5;
  return 3.2;
}

export function CoeffMap({
  grain,
  index,
  metric = 'coef',
  focusRegion = null,
  baselineGeoid = null,
  selectedGeoid = null,
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
  const instanceRef = useRef<echarts.EChartsType | null>(null);
  const onSelectRef = useRef(onSelect);
  const selectedGeoidRef = useRef(selectedGeoid);
  const mapNameRef = useRef('');
  const flownGeoidRef = useRef<string | null>(null);
  const skipFlyRef = useRef(false);
  const [viewEpoch, setViewEpoch] = useState(0);
  const mapName = `coeff-${grain}`;

  onSelectRef.current = onSelect;
  selectedGeoidRef.current = selectedGeoid;

  const mapReady = Boolean(geo && !loading && !error);

  useEffect(() => {
    if (!geo || !mapReady) return;
    echarts.registerMap(
      mapName,
      geo as unknown as Parameters<typeof echarts.registerMap>[1],
    );
  }, [geo, mapName, mapReady]);

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
    if (metric === 'coef') return computeDomain(vals.length ? vals : [1]);
    if (!vals.length) return computeDomain([1]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const mid = (min + max) / 2 || 1;
    return {
      lo: min,
      hi: max,
      min,
      max,
      _mid: mid,
    } as ReturnType<typeof computeDomain> & { _mid?: number };
  }, [seriesData, metric]);

  const pieces = useMemo(() => {
    const stops: { gt?: number; gte?: number; lt?: number; lte?: number; color: string }[] = [];
    if (metric !== 'coef') {
      const { lo, hi } = domain;
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a = lo + ((hi - lo) * i) / n;
        const b = lo + ((hi - lo) * (i + 1) / n);
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
      return { backgroundColor: t.background };
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
          id: SERIES_ID,
          name: INDEX_LABEL[index],
          type: 'map',
          map: mapName,
          roam: true,
          selectedMode: 'single',
          scaleLimit: { min: 1, max: 16 },
          nameProperty: 'geoid',
          label: { show: false },
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
              borderWidth: 2,
            },
            label: { show: false },
          },
          data: seriesData.map((d: { name: string; value: number | null; record: CoeffRecord | undefined }) => ({
            name: d.name,
            value: d.value ?? undefined,
            record: d.record,
            selected: Boolean(selectedGeoid) && d.name === selectedGeoid,
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
    t,
    index,
    metric,
    grain,
    meta,
    seriesData,
    pieces,
    selectedGeoid,
  ]);

  useEffect(() => {
    const container = chartRef.current;
    if (!container) return;
    const chart = echarts.getInstanceByDom(container) ?? echarts.init(container);
    instanceRef.current = chart;
    const onClick = (params: unknown) => {
      const handler = onSelectRef.current;
      if (!handler) return;
      const p = params as {
        data?: { record?: CoeffRecord; name?: string };
        name?: string;
      };
      const rec = p.data?.record ?? null;
      const id = p.data?.name ?? rec?.geoid ?? p.name ?? null;
      if (!id) return;
      if (id === selectedGeoidRef.current) {
        handler(null, null);
        return;
      }
      handler(rec, id);
    };
    chart.on('click', onClick);
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
      chart.off('click', onClick);
      chart.dispose();
      instanceRef.current = null;
    };
  }, [viewEpoch]);

  useEffect(() => {
    const container = chartRef.current;
    if (!container) return;
    const chart = echarts.getInstanceByDom(container);
    if (!chart) return;
    const layoutKey = mapReady ? mapName : `${mapName}:loading`;
    const identityChanged = mapNameRef.current !== layoutKey;
    mapNameRef.current = layoutKey;
    const skipFly = skipFlyRef.current;
    if (skipFly) {
      skipFlyRef.current = false;
      flownGeoidRef.current = selectedGeoid;
    }
    if (identityChanged) flownGeoidRef.current = null;
    chart.setOption(option, { notMerge: identityChanged || skipFly });
    const shouldFly =
      Boolean(selectedGeoid) &&
      !skipFly &&
      flownGeoidRef.current !== selectedGeoid &&
      mapReady &&
      Boolean(geo);
    if (shouldFly && selectedGeoid && geo) {
      const coords = coordsFor(data?.[selectedGeoid], geo, selectedGeoid);
      if (coords) {
        flownGeoidRef.current = selectedGeoid;
        chart.setOption({
          series: [{ id: SERIES_ID, center: coords, zoom: flyZoom(grain) }],
        });
      }
    }
    if (!selectedGeoid) flownGeoidRef.current = null;
  }, [option, mapName, mapReady, selectedGeoid, geo, data, grain, viewEpoch]);

  const resetView = () => {
    skipFlyRef.current = true;
    flownGeoidRef.current = selectedGeoid;
    setViewEpoch((n) => n + 1);
  };

  const heightCss = typeof height === 'number' ? `${height}px` : height;
  const statusMessage = error
    ? error
    : loading || !mapReady
      ? 'Loading map…'
      : null;

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: heightCss,
        background: t.background,
        overflow: 'hidden',
        fontFamily: t.fontFamily,
      }}
    >
      <div key={viewEpoch} ref={chartRef} style={{ width: '100%', height: '100%' }} />
      {mapReady && (
        <div className="coeff-map-chrome">
          <button type="button" onClick={resetView} aria-label="Reset map view">
            Reset view
          </button>
        </div>
      )}
      {statusMessage && (
        <div
          className={`coeff-map-status${error ? ' coeff-map-status-error' : ''}`}
          style={{ background: `${t.background}b8`, color: error ? '#b91c1c' : t.muted }}
        >
          {statusMessage}
        </div>
      )}
      {showLegend && mapReady && metric === 'coef' && (
        <div className="coeff-map-legend-wrap">
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
      {meta && mapReady && (
        <div className="coeff-map-footnote" style={{ color: t.muted }}>
          {grain === 'county' && 'County: OUSEA experimental'}
          {grain === 'place' && 'Place: rent-scaled proxy'}
          {grain === 'metro' && 'Metro: BEA MARPP 2024'}
        </div>
      )}
    </div>
  );
}

export default CoeffMap;
