export type SeriesGroup =
  | "headline"
  | "composite"
  | "component"
  | "price"
  | "unorthodox"
  | "context";

export interface SeriesMeta {
  key: string;
  label: string;
  group: SeriesGroup;
  source: string;
  seriesId: string;
  url: string;
  units: string;
  frequency: string;
  note: string;
  cpiWeight: number | null;
  livedWeight: number | null;
}

export interface InflationData {
  meta: {
    baseMonth: string;
    birthDate: string;
    retrieved: string;
    latestMonth: string;
    method: string;
    notes: Record<string, unknown>;
  };
  series: SeriesMeta[];
  months: string[];
  coefficients: Record<string, Array<number | null>>;
}

export type WeightMap = Record<string, number>;
export type CompositeKind = "composite_cpi" | "composite_lived";

export async function loadData(): Promise<InflationData> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/inflation.json`);
  if (!response.ok) throw new Error(`Inflation data failed to load (${response.status})`);
  return response.json() as Promise<InflationData>;
}

export function defaultWeights(data: InflationData, kind: CompositeKind): WeightMap {
  const field = kind === "composite_cpi" ? "cpiWeight" : "livedWeight";
  return Object.fromEntries(
    data.series
      .filter((series) => series.group === "component" && series[field] !== null)
      .map((series) => [series.key, series[field] ?? 0]),
  );
}

export function geometricComposite(
  data: InflationData,
  weights: WeightMap,
): Array<number | null> {
  return data.months.map((_, index) => {
    let weightedLog = 0;
    let totalWeight = 0;
    for (const [key, weight] of Object.entries(weights)) {
      const value = data.coefficients[key]?.[index];
      if (weight > 0 && value !== null && value !== undefined && value > 0) {
        weightedLog += weight * Math.log(value);
        totalWeight += weight;
      }
    }
    return totalWeight ? Math.exp(weightedLog / totalWeight) : null;
  });
}

export function getCoefficientSeries(
  data: InflationData,
  key: string,
  cpiWeights: WeightMap,
  livedWeights: WeightMap,
): Array<number | null> {
  if (key === "composite_cpi") return geometricComposite(data, cpiWeights);
  if (key === "composite_lived") return geometricComposite(data, livedWeights);
  return data.coefficients[key] ?? [];
}

export function monthKey(value: string): string {
  return value.slice(0, 7);
}

export function nearestPriorIndex(
  months: string[],
  values: Array<number | null>,
  dateValue: string,
): number {
  const target = monthKey(dateValue);
  let index = months.length - 1;
  while (index >= 0 && months[index] > target) index -= 1;
  while (index >= 0 && values[index] == null) index -= 1;
  return index;
}

export interface ConversionResult {
  result: number;
  factor: number;
  fromIndex: number;
  toIndex: number;
  fromMonth: string;
  toMonth: string;
}

export function convertAmount(
  amount: number,
  fromDate: string,
  toDate: string,
  months: string[],
  values: Array<number | null>,
): ConversionResult {
  const fromIndex = nearestPriorIndex(months, values, fromDate);
  const toIndex = nearestPriorIndex(months, values, toDate);
  if (fromIndex < 0 || toIndex < 0) {
    throw new Error("This series does not have data for one of the selected dates.");
  }
  const from = values[fromIndex];
  const to = values[toIndex];
  if (from == null || to == null || !Number.isFinite(amount)) {
    throw new Error("Enter a valid amount and dates with available data.");
  }
  const factor = to / from;
  return {
    result: amount * factor,
    factor,
    fromIndex,
    toIndex,
    fromMonth: months[fromIndex],
    toMonth: months[toIndex],
  };
}

export interface LocationConversionResult extends ConversionResult {
  timeFactor: number;
  spatialFactor: number;
}

export function convertAmountWithLocation(
  amount: number,
  fromDate: string,
  toDate: string,
  months: string[],
  values: Array<number | null>,
  fromSpatialCoefficient: number,
  toSpatialCoefficient: number,
): LocationConversionResult {
  if (
    !Number.isFinite(fromSpatialCoefficient) ||
    !Number.isFinite(toSpatialCoefficient) ||
    fromSpatialCoefficient <= 0 ||
    toSpatialCoefficient <= 0
  ) {
    throw new Error("Select locations with valid cost-of-living coefficients.");
  }
  const time = convertAmount(amount, fromDate, toDate, months, values);
  const spatialFactor = toSpatialCoefficient / fromSpatialCoefficient;
  const factor = time.factor * spatialFactor;
  return {
    ...time,
    result: amount * factor,
    factor,
    timeFactor: time.factor,
    spatialFactor,
  };
}

export function annualizedRate(coefficient: number, fromMonth: string, toMonth: string): number {
  const start = new Date(`${fromMonth}-01T00:00:00`);
  const end = new Date(`${toMonth}-01T00:00:00`);
  const years = (end.getTime() - start.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
  return years > 0 ? coefficient ** (1 / years) - 1 : 0;
}

export function formatMonth(month: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00Z`));
}
