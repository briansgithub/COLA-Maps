import { useState } from "react";
import { annualizedRate, formatMonth, geometricComposite, getCoefficientSeries, monthKey, rebaseSeries, seriesRange, type InflationData, type WeightMap } from "./data";
import { TimeSeriesChart, type ChartLine } from "./TimeSeriesChart";
const THEME_GROUPS = [
  {
    title: "Everyday essentials",
    description: "Recurring costs that show up in a household budget every month.",
    keys: ["cpi", "food_home", "food_away", "rent", "electricity", "utility_gas", "water", "gasoline"],
  },
  {
    title: "Big-ticket items & services",
    description: "Housing, insurance, education, health, and vehicles—the costs that can reshape a life plan.",
    keys: ["cpi", "home_prices", "oer", "medical", "auto_ins", "tuition", "new_cars", "used_cars"],
  },
  {
    title: "Other spending",
    description: "The quieter categories that explain why personal inflation differs from the headline.",
    keys: ["cpi", "recreation", "communication", "personal_care", "public_transit", "car_repair", "tobacco"],
  },
  {
    title: "Actual shelf prices",
    description: "Observed dollar prices, normalized to your selected anchor, rather than broad category indexes.",
    keys: ["cpi", "eggs", "milk", "bread", "ground_beef", "chicken", "bananas", "elec_kwh", "gas_gallon"],
  },
  {
    title: "Unorthodox cross-checks",
    description: "Familiar purchases provide an intuitive check on formal inflation measures.",
    keys: ["cpi", "composite_lived", "big_mac", "stamp", "thanksgiving"],
  },
  {
    title: "Wages vs prices vs housing",
    description: "Income gained ground on CPI, but home prices moved much faster.",
    keys: ["cpi", "composite_lived", "wages", "home_prices", "median_home", "real_wage"],
  },
];

const SERIES_COLORS: Record<string, string> = {
  cpi: "#0f172a",
  pce: "#64748b",
  composite_cpi: "#c2410c",
  composite_lived: "#2563eb",
};

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function seriesLabel(data: InflationData, key: string): string {
  return data.series.find((series) => series.key === key)?.label ?? key;
}

function makeLines(
  data: InflationData,
  keys: string[],
  cpiWeights: WeightMap,
  livedWeights: WeightMap,
  anchorDate: string,
): ChartLine[] {
  return keys
    .map((key) => ({
      key,
      label: seriesLabel(data, key),
      values: getCoefficientSeries(data, key, cpiWeights, livedWeights, anchorDate),
      color: SERIES_COLORS[key],
      width: key === "cpi" ? 3 : undefined,
    }))
    .filter((line) => line.values.some((value) => value !== null));
}

export default function Explore({
  data,
  cpiWeights,
  livedWeights,
  anchorDate,
  onAnchorChange,
  onConvert,
}: {
  data: InflationData;
  cpiWeights: WeightMap;
  livedWeights: WeightMap;
  anchorDate: string;
  onAnchorChange: (date: string) => void;
  onConvert: () => void;
}) {
  const [compareMore, setCompareMore] = useState(false);
  const [category, setCategory] = useState(0);
  const latestIndex = data.months.length - 1;
  const officialSeries = getCoefficientSeries(data, "cpi", cpiWeights, livedWeights, anchorDate);
  const pceSeries = getCoefficientSeries(data, "pce", cpiWeights, livedWeights, anchorDate);
  const cpiComposite = rebaseSeries(data.months, geometricComposite(data, cpiWeights), anchorDate);
  const livedComposite = rebaseSeries(data.months, geometricComposite(data, livedWeights), anchorDate);
  const official = officialSeries[latestIndex];
  const pce = pceSeries[latestIndex];
  const cpiLatest = cpiComposite[latestIndex];
  const livedLatest = livedComposite[latestIndex];
  const anchorMonth = monthKey(anchorDate);
  const anchorLabel = formatMonth(anchorMonth);
  const rate = livedLatest == null ? null : annualizedRate(livedLatest, anchorMonth, data.meta.latestMonth);
  const mainLines = [
    { key: "cpi", label: "Official CPI-U", values: officialSeries, color: SERIES_COLORS.cpi },
    { key: "pce", label: "PCE price index", values: pceSeries, color: SERIES_COLORS.pce },
    { key: "composite_cpi", label: "CPI-style basket", values: cpiComposite, color: SERIES_COLORS.composite_cpi },
    { key: "composite_lived", label: "Personal basket", values: livedComposite, color: SERIES_COLORS.composite_lived, width: 3 },
  ];
  const availableMainLines = mainLines.filter(line => compareMore || ["cpi", "composite_lived"].includes(line.key)).filter((line) => line.values.some((value) => value !== null));
  const unavailableMain = mainLines.filter((line) => !line.values.some((value) => value !== null));
  const coefficientText = (value: number | null) => value == null ? "Unavailable" : `${value.toFixed(2)}×`;

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>Price trends</h1>
          <p className="hero-lede">
            From {anchorLabel}: CPI <strong>{coefficientText(official)}</strong>
            {" · "}personal basket <strong>{coefficientText(livedLatest)}</strong>
            {rate != null && <> · {(rate * 100).toFixed(2)}%/yr</>}
            {" · "}through {formatMonth(data.meta.latestMonth)}
          </p>
        </div>
        <div className="hero-aside">
          <div className="hero-number" aria-label={`Lived experience coefficient ${coefficientText(livedLatest)}`}>
            <span className="number-label">Personal basket</span>
            <strong>{livedLatest == null ? "—" : livedLatest.toFixed(2)}{livedLatest != null && <small>×</small>}</strong>
          </div>
          <button className="primary" onClick={onConvert}>Convert</button>
        </div>
      </section>


      <section className="chart-feature">
        <div className="section-heading">
          <h2>How prices have changed</h2>
          <div className="anchor-control">
            <label>
              Compare from
              <input
                type="date"
                min={`${data.meta.firstMonth}-01`}
                max={`${data.meta.latestMonth}-28`}
                value={anchorDate}
                onChange={(event) => onAnchorChange(event.target.value)}
              />
            </label>
            <small>{anchorLabel} = 1.00</small>
          </div>
        </div>
        <label className="compare-toggle"><input type="checkbox" checked={compareMore} onChange={event => setCompareMore(event.target.checked)} />Compare more measures <small>PCE and CPI-style basket</small></label>
        {unavailableMain.length > 0 && (
          <p className="chart-availability">
            Not shown: {unavailableMain.map((line) => line.label).join(", ")}.
          </p>
        )}
        <TimeSeriesChart
          months={data.months}
          zoom
          height={340}
          lines={availableMainLines}
          markers={[{ month: anchorMonth, label: "Anchor" }]}
        />
      </section>

      <div className="theme-charts">
        <div className="theme-charts-head">
          <h2>Explore a category</h2>
          <p>Same dollar, split by spending group.</p>
        </div>
        <label className="category-select">Spending group<select value={category} onChange={event => setCategory(Number(event.target.value))}>{THEME_GROUPS.map((group, index) => <option key={group.title} value={index}>{group.title}</option>)}</select></label>
        {[THEME_GROUPS[category]].map((group) => {
          const lines = makeLines(data, group.keys, cpiWeights, livedWeights, anchorDate);
          const available = new Set(lines.map((line) => line.key));
          const omitted = group.keys.filter((key) => !available.has(key));
          return (
            <section className="theme-section" key={group.title}>
              <div className="theme-copy">
                <h3>{group.title}</h3>
                <p>{group.description}</p>
                {omitted.length > 0 && (
                  <small className="theme-availability">
                    Missing at {anchorLabel}: {omitted.map((key) => seriesLabel(data, key)).join(", ")}.
                  </small>
                )}
              </div>
              <div className="theme-chart">
                <TimeSeriesChart months={data.months} lines={lines} height={280} />
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
