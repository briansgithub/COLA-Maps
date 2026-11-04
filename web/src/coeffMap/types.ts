/** Geographic grain — no state or ZIP layer in this package. */
export type CoeffGrain = 'metro' | 'county' | 'place';

/**
 * Selectable index. BEA is recommended for salary PP scaling.
 * ACS/HUD are housing-only. Averages are exploratory.
 * Subindices (housing/goods/other_services/utilities) are BEA metro only
 * (place has housing proxy; county has all-items only for BEA/OUSEA).
 */
export type CoeffIndex =
  | 'bea'
  | 'acs'
  | 'hud'
  | 'avg_simple'
  | 'avg_weighted'
  | 'housing'
  | 'goods'
  | 'other_services'
  | 'utilities';

/** Whether to color/select by coefficient (median=1) or raw index value. */
export type CoeffMetric = 'coef' | 'raw';

export type FocusRegion =
  | 'la'
  | 'nyc'
  | 'nj'
  | 'denver_boulder'
  | 'north_alabama'
  | 'all';

export interface CoeffRecord {
  geoid: string;
  name: string | null;
  state: string | null;
  region: string | null;
  population: number | null;
  lat?: number | null;
  lon?: number | null;
  // BEA / proxy
  rpp_all_items?: number | null;
  coef_bea?: number | null;
  rpp_housing?: number | null;
  coef_housing?: number | null;
  rpp_goods?: number | null;
  coef_goods?: number | null;
  rpp_other_services?: number | null;
  coef_other_services?: number | null;
  rpp_utilities?: number | null;
  coef_utilities?: number | null;
  coef_vs_us?: number | null;
  // ACS / HUD
  acs_rent?: number | null;
  coef_acs?: number | null;
  hud_fmr_2br?: number | null;
  coef_hud?: number | null;
  // Averages
  coef_avg_simple?: number | null;
  avg_simple_inputs?: string | null;
  coef_avg_weighted?: number | null;
  avg_weighted_inputs?: string | null;
  // Metro extras
  is_major?: boolean | null;
  // County extras
  is_focus?: boolean | null;
  cbsa_code?: string | null;
  data_source?: string | null;
  rpp_year?: string | null;
  // Place extras
  regions?: string | null;
  county_fips?: string | null;
  county_name?: string | null;
  rent_ratio?: number | null;
  housing_weight_w?: number | null;
}

export type CoeffDataMap = Record<string, CoeffRecord>;

export interface CoeffMeta {
  schemaVersion: string;
  package: string;
  description: string;
  grains: Record<
    string,
    { id: string; count: number; coverage: string; note?: string }
  >;
  notIncluded: string[];
  denominators: {
    bea_rpp_metro_median: number;
    acs_rent_metro_median_usd: number;
    hud_fmr_2br_metro_median_usd: number;
    us_average_bea_rpp: number;
    [key: string]: unknown;
  };
  indices: Record<string, unknown>;
  coverage: Record<string, number>;
  vintages: Record<string, string>;
  sources: Record<string, string>;
  focusRegions: Record<string, string[]>;
  coefficientDefinition: string;
  salaryScaling: {
    formula: string;
    recommendedIndex: string;
    baselineExample: { place: string; coef_bea: number; rpp: number };
  };
  caveats: string[];
  fieldMap: {
    coefFieldByIndex: Record<string, keyof CoeffRecord | string>;
    rawFieldByIndex: Record<string, keyof CoeffRecord | string>;
    metric: Record<string, string>;
  };
  placeProxy?: Record<string, unknown>;
  skippedIndices?: Record<string, string>;
}

export interface CoeffTheme {
  /** Deep ink/slate background for the map panel */
  background?: string;
  /** Border / card surface */
  surface?: string;
  /** Primary text */
  text?: string;
  /** Muted text */
  muted?: string;
  /** Teal end for values below 1.00 */
  tealLow?: string;
  /** Near-neutral at 1.00 */
  neutral?: string;
  /** Copper end for values above 1.00 */
  copperHigh?: string;
  /** Missing data fill */
  missing?: string;
  /** Border stroke on regions */
  stroke?: string;
  fontFamily?: string;
}

export const DEFAULT_THEME: Required<CoeffTheme> = {
  background: '#0f172a',
  surface: '#1e293b',
  text: '#e2e8f0',
  muted: '#94a3b8',
  tealLow: '#0284c7',
  neutral: '#cbd5e1',
  copperHigh: '#c2410c',
  missing: '#334155',
  stroke: '#0f172a',
  fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
};

export interface CoeffMapProps {
  /** Geography grain */
  grain: CoeffGrain;
  /** Which index to display */
  index: CoeffIndex;
  /** Coefficient (default) or raw value */
  metric?: CoeffMetric;
  /** Optional focus region filter (place/county); metro ignores */
  focusRegion?: FocusRegion | null;
  /** Optional baseline GEOID for relative rebasing in tooltips/selection */
  baselineGeoid?: string | null;
  /** Controlled selected feature (highlight + fly-to) */
  selectedGeoid?: string | null;
  /** Called when a feature is clicked, or when the current selection is cleared */
  onSelect?: (record: CoeffRecord | null, geoid: string | null) => void;
  /** Map height CSS value */
  height?: string | number;
  /** Theme overrides (ledger: deep ink, teal below 1, copper above 1) */
  theme?: CoeffTheme;
  /** Show legend (default true) */
  showLegend?: boolean;
  /** Class name on outer wrapper */
  className?: string;
}

export const COEF_FIELD: Record<CoeffIndex, keyof CoeffRecord> = {
  bea: 'coef_bea',
  acs: 'coef_acs',
  hud: 'coef_hud',
  avg_simple: 'coef_avg_simple',
  avg_weighted: 'coef_avg_weighted',
  housing: 'coef_housing',
  goods: 'coef_goods',
  other_services: 'coef_other_services',
  utilities: 'coef_utilities',
};

export const RAW_FIELD: Record<CoeffIndex, keyof CoeffRecord> = {
  bea: 'rpp_all_items',
  acs: 'acs_rent',
  hud: 'hud_fmr_2br',
  avg_simple: 'coef_avg_simple', // averages are already coefs
  avg_weighted: 'coef_avg_weighted',
  housing: 'rpp_housing',
  goods: 'rpp_goods',
  other_services: 'rpp_other_services',
  utilities: 'rpp_utilities',
};

export const INDEX_LABEL: Record<CoeffIndex, string> = {
  bea: 'BEA RPP',
  acs: 'ACS Rent',
  hud: 'HUD FMR 2BR',
  avg_simple: 'Average (simple)',
  avg_weighted: 'Average (weighted)',
  housing: 'BEA Housing',
  goods: 'BEA Goods',
  other_services: 'BEA Other services',
  utilities: 'BEA Utilities',
};
