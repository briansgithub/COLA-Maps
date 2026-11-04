import { useEffect, useMemo, useState } from 'react';
import type {
  CoeffDataMap,
  CoeffGrain,
  CoeffMeta,
  FocusRegion,
} from './types';

export interface CoeffBundle {
  meta: CoeffMeta | null;
  data: CoeffDataMap | null;
  geo: GeoJSON.FeatureCollection | null;
  loading: boolean;
  error: string | null;
}

function baseUrl(): string {
  const b =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.BASE_URL === 'string'
      ? import.meta.env.BASE_URL
      : '/';
  return b.endsWith('/') ? b : `${b}/`;
}

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${baseUrl()}${path.replace(/^\//, '')}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

const cache = new Map<string, Promise<unknown>>();

function cachedFetch<T>(path: string): Promise<T> {
  const existing = cache.get(path);
  if (existing) return existing as Promise<T>;
  const p = fetchJson<T>(path);
  cache.set(path, p);
  return p;
}

function padFips(f: string): string {
  return f.padStart(5, '0');
}

/** Load meta.json once. */
export function useCoeffMeta(): {
  meta: CoeffMeta | null;
  loading: boolean;
  error: string | null;
} {
  const [meta, setMeta] = useState<CoeffMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cachedFetch<CoeffMeta>('data/coeff-map/meta.json')
      .then((m) => {
        if (!cancelled) {
          setMeta(m);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { meta, loading, error };
}

/**
 * Load attribute JSON + GeoJSON for a grain.
 * Paths resolve under import.meta.env.BASE_URL + 'data/coeff-map/...'
 */
export function useCoeffData(grain: CoeffGrain): CoeffBundle {
  const { meta, loading: metaLoading, error: metaError } = useCoeffMeta();
  const [data, setData] = useState<CoeffDataMap | null>(null);
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loadedGrain, setLoadedGrain] = useState<CoeffGrain | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      cachedFetch<CoeffDataMap>(`data/coeff-map/${grain}.json`),
      cachedFetch<GeoJSON.FeatureCollection>(
        `data/coeff-map/geo/${grain}.geojson`,
      ),
    ])
      .then(([d, g]) => {
        if (!cancelled) {
          setData(d);
          setGeo(g);
          setLoadedGrain(grain);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [grain]);

  const stale = loadedGrain !== grain;
  return {
    meta,
    data: stale ? null : data,
    geo: stale ? null : geo,
    loading: loading || metaLoading || stale,
    error: error || metaError,
  };
}

/** Filter data/geo by focus region using meta.focusRegions county FIPS lists. */
export function filterByFocusRegion(
  grain: CoeffGrain,
  data: CoeffDataMap,
  geo: GeoJSON.FeatureCollection,
  meta: CoeffMeta | null,
  focus: FocusRegion | null | undefined,
): { data: CoeffDataMap; geo: GeoJSON.FeatureCollection } {
  if (!focus || focus === 'all' || grain === 'metro') {
    return { data, geo };
  }

  if (grain === 'county') {
    const key =
      focus === 'denver_boulder'
        ? 'denver_boulder'
        : focus === 'north_alabama'
          ? 'north_alabama'
          : focus;
    const fipsList = meta?.focusRegions?.[key];
    if (!fipsList?.length) return { data, geo };
    const set = new Set(fipsList.map(padFips));
    const strict: CoeffDataMap = {};
    for (const f of set) {
      if (data[f]) strict[f] = data[f];
    }
    const ids = new Set(Object.keys(strict));
    const features = geo.features.filter((f: GeoJSON.Feature) => {
      const id = String(
        f.id ?? (f.properties as { geoid?: string } | null)?.geoid ?? '',
      );
      return ids.has(id);
    });
    return {
      data: strict,
      geo: { type: 'FeatureCollection', features },
    };
  }

  // place: filter by region_primary / regions string
  const regionKey =
    focus === 'denver_boulder'
      ? 'denver'
      : focus === 'north_alabama'
        ? 'nal'
        : focus;
  const filteredData: CoeffDataMap = {};
  for (const [k, v] of Object.entries(data)) {
    const primary = (v.region || '').toLowerCase();
    const regions = (v.regions || '').toLowerCase();
    if (
      primary === regionKey ||
      regions.split('|').map((s) => s.trim()).includes(regionKey)
    ) {
      filteredData[k] = v;
    }
  }
  const ids = new Set(Object.keys(filteredData));
  const features = geo.features.filter((f: GeoJSON.Feature) => {
    const id = String(
      f.id ?? (f.properties as { geoid?: string } | null)?.geoid ?? '',
    );
    return ids.has(id);
  });
  return {
    data: filteredData,
    geo: { type: 'FeatureCollection', features },
  };
}

export function useFilteredCoeffData(
  grain: CoeffGrain,
  focusRegion?: FocusRegion | null,
): CoeffBundle {
  const bundle = useCoeffData(grain);
  const filtered = useMemo(() => {
    if (!bundle.data || !bundle.geo) {
      return { data: bundle.data, geo: bundle.geo };
    }
    return filterByFocusRegion(
      grain,
      bundle.data,
      bundle.geo,
      bundle.meta,
      focusRegion,
    );
  }, [bundle.data, bundle.geo, bundle.meta, grain, focusRegion]);

  return {
    ...bundle,
    data: filtered.data,
    geo: filtered.geo,
  };
}
