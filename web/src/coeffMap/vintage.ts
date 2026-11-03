import type { CoeffGrain, CoeffIndex, CoeffMeta, CoeffRecord } from './types';

function yearFromIndex(meta: CoeffMeta | null, key: string): string | null {
  const entry = meta?.indices?.[key];
  if (!entry || typeof entry !== 'object' || !('year' in entry)) return null;
  const year = (entry as { year?: unknown }).year;
  return typeof year === 'string' ? year : null;
}

export function coefficientVintage(
  meta: CoeffMeta | null,
  grain: CoeffGrain,
  index: CoeffIndex,
): string {
  if (index === 'hud') return yearFromIndex(meta, 'hud_fmr') ?? 'FY2025';
  if (index === 'acs') return yearFromIndex(meta, 'acs_rent') ?? '2019–2023';
  if (index === 'avg_simple' || index === 'avg_weighted') {
    return '2024 / 2019–2023 / FY2025';
  }
  if (grain === 'county') return '≈2021';
  if (grain === 'place') {
    return index === 'housing' ? '≈2021 + 2019–2023' : '≈2021 proxy';
  }
  return yearFromIndex(meta, 'bea_rpp') ?? '2024';
}

export function formatLocationLabel(
  record: Pick<CoeffRecord, 'name' | 'state'> | null | undefined,
  vintage: string,
  fallback = 'Unknown location',
): string {
  const name = record?.name?.trim() || fallback;
  const state = record?.state?.trim();
  const place = state && !name.endsWith(`, ${state}`) ? `${name}, ${state}` : name;
  return `${place} (${vintage})`;
}
