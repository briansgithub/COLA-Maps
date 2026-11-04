import { useEffect, useMemo, useState } from "react";
import {
  annualizedRate,
  convertAmountWithLocation,
  defaultWeights,
  formatMonth,
  geometricComposite,
  getCoefficientSeries,
  getLevelSeries,
  loadData,
  monthKey,
  rebaseSeries,
  seriesRange,
  type CompositeKind,
  type InflationData,
  type SeriesMeta,
  type WeightMap,
} from "./data";
import { TimeSeriesChart, type ChartLine } from "./TimeSeriesChart";
import { ACRONYMS, BIBLIOGRAPHY, RELIABILITY_NOTES } from "./sourceDocs";
import {
  CoeffMap,
  INDEX_LABEL,
  coefficientVintage,
  formatLocationLabel,
  getCoef,
  useCoeffData,
  useCoeffMeta,
  type CoeffGrain,
  type CoeffIndex,
  type CoeffRecord,
  type FocusRegion,
} from "./coeffMap";

type Tab = "explore" | "map" | "converter" | "weights" | "sources";

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

function useWeights(data: InflationData | null, kind: CompositeKind) {
  const storageKey = `inflation-weights-v1-${kind}`;
  const [weights, setWeights] = useState<WeightMap>({});

  useEffect(() => {
    if (!data) return;
    const fallback = defaultWeights(data, kind);
    try {
      const saved = localStorage.getItem(storageKey);
      setWeights(saved ? { ...fallback, ...JSON.parse(saved) } : fallback);
    } catch {
      setWeights(fallback);
    }
  }, [data, kind, storageKey]);

  const save = (next: WeightMap) => {
    setWeights(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };
  const reset = () => {
    if (!data) return;
    const defaults = defaultWeights(data, kind);
    setWeights(defaults);
    localStorage.removeItem(storageKey);
  };
  return { weights, save, reset };
}

function useAnchor(data: InflationData | null) {
  const [anchorDate, setAnchorDateState] = useState("1995-01-20");
  useEffect(() => {
    if (!data) return;
    const saved = localStorage.getItem("inflation-anchor-v1");
    const candidate = saved || data.meta.defaultAnchorDate || data.meta.birthDate;
    const month = monthKey(candidate);
    setAnchorDateState(
      month >= data.meta.firstMonth && month <= data.meta.latestMonth
        ? candidate
        : data.meta.defaultAnchorDate,
    );
  }, [data]);
  const setAnchorDate = (next: string) => {
    setAnchorDateState(next);
    localStorage.setItem("inflation-anchor-v1", next);
  };
  return { anchorDate, setAnchorDate };
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

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function App() {
  const [data, setData] = useState<InflationData | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>(() => {
    const hash = location.hash.replace("#", "");
    return ["explore", "map", "converter", "weights", "sources"].includes(hash) ? (hash as Tab) : "explore";
  });
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [updateApp, setUpdateApp] = useState<(() => Promise<void>) | null>(null);
  const cpi = useWeights(data, "composite_cpi");
  const lived = useWeights(data, "composite_lived");
  const anchor = useAnchor(data);

  useEffect(() => {
    loadData().then(setData).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "The inflation data could not be loaded.");
    });
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<() => Promise<void>>).detail;
      setUpdateApp(() => detail);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("pwa-update", onUpdate);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("pwa-update", onUpdate);
    };
  }, []);

  const selectTab = (next: Tab) => {
    setTab(next);
    history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  if (error) {
    return (
      <main className="state-page">
        <p className="eyebrow">Dollar Since 1995</p>
        <h1>Data unavailable</h1>
        <p>{error}</p>
        <button onClick={() => location.reload()}>Try again</button>
      </main>
    );
  }

  if (!data || Object.keys(cpi.weights).length === 0 || Object.keys(lived.weights).length === 0) {
    return (
      <main className="state-page loading">
        <div className="loading-mark">$</div>
        <p>Loading more than a century of prices…</p>
      </main>
    );
  }

  return (
    <>
      <header className="site-header">
        <button className="brand" onClick={() => selectTab("explore")} aria-label="Dollar Since 1995 home">
          <span className="brand-mark">$</span>
          <span>Dollar Since <strong>1995</strong></span>
        </button>
        <nav aria-label="Main navigation">
          {(["explore", "map", "converter", "weights", "sources"] as Tab[]).map((item) => (
            <button
              key={item}
              className={tab === item ? "active" : ""}
              onClick={() => selectTab(item)}
              aria-current={tab === item ? "page" : undefined}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
        {installPrompt && <button className="install-button" onClick={install}>Install app</button>}
      </header>

      {updateApp && (
        <div className="update-banner">
          Fresh data is ready.
          <button onClick={() => void updateApp()}>Update now</button>
        </div>
      )}

      <main>
        {tab === "explore" && (
          <Explore
            data={data}
            cpiWeights={cpi.weights}
            livedWeights={lived.weights}
            anchorDate={anchor.anchorDate}
            onAnchorChange={anchor.setAnchorDate}
            onConvert={() => selectTab("converter")}
          />
        )}
        {tab === "map" && <MapTab />}
        {tab === "converter" && (
          <Converter data={data} cpiWeights={cpi.weights} livedWeights={lived.weights} />
        )}
        {tab === "weights" && (
          <Weights
            data={data}
            cpiWeights={cpi.weights}
            livedWeights={lived.weights}
            onSaveCpi={cpi.save}
            onSaveLived={lived.save}
            onResetCpi={cpi.reset}
            onResetLived={lived.reset}
          />
        )}
        {tab === "sources" && <Sources data={data} />}
      </main>

      <footer>
        <p>Through {formatMonth(data.meta.latestMonth)} · Retrieved {data.meta.retrieved}</p>
      </footer>
    </>
  );
}

function Explore({
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
    { key: "composite_lived", label: "Lived-experience basket", values: livedComposite, color: SERIES_COLORS.composite_lived, width: 3 },
  ];
  const availableMainLines = mainLines.filter((line) => line.values.some((value) => value !== null));
  const unavailableMain = mainLines.filter((line) => !line.values.some((value) => value !== null));
  const coefficientText = (value: number | null) => value == null ? "Unavailable" : `${value.toFixed(2)}×`;

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>Dollar Since 1995</h1>
          <p className="hero-lede">
            From {anchorLabel}: CPI <strong>{coefficientText(official)}</strong>
            {" · "}lived basket <strong>{coefficientText(livedLatest)}</strong>
            {rate != null && <> · {(rate * 100).toFixed(2)}%/yr</>}
            {" · "}through {formatMonth(data.meta.latestMonth)}
          </p>
        </div>
        <div className="hero-aside">
          <div className="hero-number" aria-label={`Lived experience coefficient ${coefficientText(livedLatest)}`}>
            <span className="number-label">Lived coefficient</span>
            <strong>{livedLatest == null ? "—" : livedLatest.toFixed(2)}{livedLatest != null && <small>×</small>}</strong>
          </div>
          <button className="primary" onClick={onConvert}>Convert</button>
        </div>
      </section>

      <section className="metric-rail" aria-label="Latest inflation measures">
        <Metric label="Official CPI-U" value={coefficientText(official)} note={official == null ? `Begins ${formatMonth(seriesRange(data.months, data.levels.cpi)!.firstMonth)}` : `${currency(1 / official)} purchasing power`} />
        <Metric label="PCE" value={coefficientText(pce)} note={pce == null ? "Not available at anchor" : "Fed preference"} />
        <Metric label="CPI-style basket" value={coefficientText(cpiLatest)} note={cpiLatest == null ? "Not available at anchor" : "Method check"} />
        <Metric label="$1 then →" value={livedLatest == null ? "Unavailable" : currency(livedLatest)} note="Lived weights" />
      </section>

      <section className="chart-feature">
        <div className="section-heading">
          <h2>Anchor comparison</h2>
          <div className="anchor-control">
            <label>
              Anchor
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
          <h2>Category breakdowns</h2>
          <p>Same dollar, split by spending group.</p>
        </div>
        {THEME_GROUPS.map((group, index) => {
          const lines = makeLines(data, group.keys, cpiWeights, livedWeights, anchorDate);
          const available = new Set(lines.map((line) => line.key));
          const omitted = group.keys.filter((key) => !available.has(key));
          return (
            <section className="theme-section" key={group.title}>
              <div className="theme-copy">
                <h3><span className="section-number">{String(index + 1).padStart(2, "0")}</span> {group.title}</h3>
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

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

const MAP_INDEXES: Record<CoeffGrain, CoeffIndex[]> = {
  metro: ["bea", "housing", "goods", "other_services", "utilities", "acs", "hud", "avg_weighted", "avg_simple"],
  county: ["bea", "acs", "hud", "avg_weighted", "avg_simple"],
  place: ["bea", "housing", "acs", "hud", "avg_weighted", "avg_simple"],
};

function MapTab() {
  const [grain, setGrain] = useState<CoeffGrain>("metro");
  const [index, setIndex] = useState<CoeffIndex>("bea");
  const [focusRegion, setFocusRegion] = useState<FocusRegion>("all");
  const [selected, setSelected] = useState<CoeffRecord | null>(null);
  const { meta } = useCoeffMeta();
  const vintage = coefficientVintage(meta, grain, index);
  const selectedCoef = getCoef(selected, index);

  const changeGrain = (next: CoeffGrain) => {
    setGrain(next);
    setIndex("bea");
    setSelected(null);
  };

  return (
    <section className="page map-page">
      <div className="page-title map-title">
        <h1>Cost map</h1>
        <p>Regional price levels vs US median. Years are source vintages, not live quotes.</p>
      </div>

      <div className="map-controls" aria-label="Map controls">
        <label>
          Geography
          <select value={grain} onChange={(event) => changeGrain(event.target.value as CoeffGrain)}>
            <option value="metro">Metro areas</option>
            <option value="county">Counties (experimental)</option>
            <option value="place">Places (focus regions)</option>
          </select>
        </label>
        <label>
          Cost measure
          <select value={index} onChange={(event) => { setIndex(event.target.value as CoeffIndex); setSelected(null); }}>
            {MAP_INDEXES[grain].map((key) => <option key={key} value={key}>{INDEX_LABEL[key]}</option>)}
          </select>
        </label>
        {grain !== "metro" && (
          <label>
            Region
            <select value={focusRegion} onChange={(event) => { setFocusRegion(event.target.value as FocusRegion); setSelected(null); }}>
              <option value="all">All available</option>
              <option value="la">Los Angeles area</option>
              <option value="nyc">New York City area</option>
              <option value="nj">New Jersey</option>
              <option value="denver_boulder">Denver / Boulder</option>
              <option value="north_alabama">North Alabama</option>
            </select>
          </label>
        )}
        <div className="map-vintage">
          <span>Vintage</span>
          <strong>{vintage}</strong>
        </div>
      </div>

      <CoeffMap
        grain={grain}
        index={index}
        focusRegion={focusRegion}
        height="clamp(360px, 55vh, 560px)"
        onSelect={(record) => setSelected(record)}
        className="cost-map"
        theme={{
          background: "#f1f5f9",
          surface: "#ffffff",
          text: "#0f172a",
          muted: "#64748b",
          tealLow: "#0284c7",
          neutral: "#cbd5e1",
          copperHigh: "#c2410c",
          missing: "#e2e8f0",
          stroke: "#f8fafc",
          fontFamily: "'IBM Plex Sans', ui-sans-serif, sans-serif",
        }}
      />

      <div className="map-selection" aria-live="polite">
        {selected ? (
          <>
            <strong>{formatLocationLabel(selected, vintage)}</strong>
            <p>{INDEX_LABEL[index]}: {selectedCoef == null ? "Unavailable" : `${selectedCoef.toFixed(3)}× median metro`}</p>
          </>
        ) : (
          <p>Click a region · scroll to zoom · drag to pan</p>
        )}
      </div>
    </section>
  );
}

interface LocationOption {
  geoid: string;
  label: string;
  coefficient: number;
}

function LocationSelect({
  id,
  label,
  value,
  options,
  loading,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: LocationOption[];
  loading: boolean;
  onChange: (geoid: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    const matches = options.filter((option) => option.label.toLowerCase().includes(term));
    const selected = options.find((option) => option.geoid === value);
    return selected && !matches.some((option) => option.geoid === value) ? [selected, ...matches] : matches;
  }, [options, query, value]);

  return (
    <label className="location-field" htmlFor={id}>
      {label}
      <input
        type="search"
        placeholder="Filter metros"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label={`Search ${label.toLowerCase()}`}
      />
      <select id={id} value={value} disabled={loading} onChange={(event) => onChange(event.target.value)}>
        {filtered.map((option) => <option key={option.geoid} value={option.geoid}>{option.label}</option>)}
      </select>
    </label>
  );
}

function Converter({
  data,
  cpiWeights,
  livedWeights,
}: {
  data: InflationData;
  cpiWeights: WeightMap;
  livedWeights: WeightMap;
}) {
  const latest = `${data.meta.latestMonth}-01`;
  const [amount, setAmount] = useState("100");
  const [fromDate, setFromDate] = useState(data.meta.birthDate);
  const [toDate, setToDate] = useState(latest);
  const [seriesKey, setSeriesKey] = useState("composite_lived");
  const [fromLocation, setFromLocation] = useState("__median__");
  const [toLocation, setToLocation] = useState("__median__");
  const [copied, setCopied] = useState(false);
  const metro = useCoeffData("metro");
  const locationVintage = coefficientVintage(metro.meta, "metro", "bea");
  const locationOptions = useMemo<LocationOption[]>(() => {
    const options: LocationOption[] = [{
      geoid: "__median__",
      label: `US median metro (${locationVintage})`,
      coefficient: 1,
    }];
    for (const record of Object.values(metro.data ?? {})) {
      const coefficient = getCoef(record, "bea");
      if (coefficient != null && record.name) {
        options.push({
          geoid: record.geoid,
          label: formatLocationLabel(record, locationVintage),
          coefficient,
        });
      }
    }
    return options.sort((a, b) => a.geoid === "__median__" ? -1 : b.geoid === "__median__" ? 1 : a.label.localeCompare(b.label));
  }, [metro.data, locationVintage]);
  const fromPlace = locationOptions.find((option) => option.geoid === fromLocation);
  const toPlace = locationOptions.find((option) => option.geoid === toLocation);

  const values = getLevelSeries(data, seriesKey, cpiWeights, livedWeights);
  const range = seriesRange(data.months, values);
  const seriesFirstDate = range ? `${range.firstMonth}-01` : `${data.meta.firstMonth}-01`;
  const seriesLastDate = range ? `${range.lastMonth}-28` : `${data.meta.latestMonth}-28`;
  useEffect(() => {
    if (!range) return;
    if (monthKey(fromDate) < range.firstMonth) setFromDate(seriesFirstDate);
    if (monthKey(fromDate) > range.lastMonth) setFromDate(seriesLastDate);
    if (monthKey(toDate) < range.firstMonth) setToDate(seriesFirstDate);
    if (monthKey(toDate) > range.lastMonth) setToDate(seriesLastDate);
  }, [fromDate, range, seriesFirstDate, seriesLastDate, toDate]);
  let conversion: ReturnType<typeof convertAmountWithLocation> | null = null;
  let conversionError = "";
  try {
    if (!fromPlace || !toPlace) throw new Error("Select both an origin and destination location.");
    conversion = convertAmountWithLocation(
      Number(amount),
      fromDate,
      toDate,
      data.months,
      values,
      fromPlace.coefficient,
      toPlace.coefficient,
    );
  } catch (reason) {
    conversionError = reason instanceof Error ? reason.message : "Conversion unavailable.";
  }
  const selected = data.series.find((series) => series.key === seriesKey);
  const copyText = conversion
    ? `${currency(Number(amount))} in ${fromPlace?.label}, ${formatMonth(conversion.fromMonth)} ≈ ${currency(conversion.result)} in ${toPlace?.label}, ${formatMonth(conversion.toMonth)}. Time factor ${conversion.timeFactor.toFixed(3)}× using ${selected?.label}; location factor ${conversion.spatialFactor.toFixed(3)}× using BEA 2024 RPP.`
    : "";

  const copy = async () => {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const presets = (type: "birth" | "reverse" | "year") => {
    if (type === "birth") {
      setFromDate(data.meta.birthDate);
      setToDate(seriesLastDate);
    } else if (type === "reverse") {
      setFromDate(seriesLastDate);
      setToDate(data.meta.birthDate);
    } else {
      const d = new Date(`${seriesLastDate}T00:00:00`);
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      setFromDate(d.toISOString().slice(0, 10));
      setToDate(seriesLastDate);
    }
  };

  return (
    <section className="page converter-page">
      <div className="page-title">
        <h1>Converter</h1>
        <p>Translate an amount across time and metro location.</p>
      </div>

      <div className="preset-row" aria-label="Date presets">
        <button onClick={() => presets("birth")}>Birth → latest</button>
        <button onClick={() => presets("reverse")}>Latest → birth</button>
        <button onClick={() => presets("year")}>One year → latest</button>
      </div>

      <div className="converter-layout">
        <form className="converter-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            Amount
            <span className="money-input"><b>$</b><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></span>
          </label>
          <div className="date-pair">
            <label>
              From
              <input type="date" min={seriesFirstDate} max={seriesLastDate} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <button
              className="swap-button"
              type="button"
              onClick={() => {
                setFromDate(toDate);
                setToDate(fromDate);
                setFromLocation(toLocation);
                setToLocation(fromLocation);
              }}
              aria-label="Swap dates and locations"
            >
              ⇄
            </button>
            <label>
              To
              <input type="date" min={seriesFirstDate} max={seriesLastDate} value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
          </div>
          <div className="location-pair">
            <LocationSelect
              id="from-location"
              label="From metro"
              value={fromLocation}
              options={locationOptions}
              loading={metro.loading}
              onChange={setFromLocation}
            />
            <LocationSelect
              id="to-location"
              label="To metro"
              value={toLocation}
              options={locationOptions}
              loading={metro.loading}
              onChange={setToLocation}
            />
          </div>
          <label>
            Measure
            <select value={seriesKey} onChange={(e) => setSeriesKey(e.target.value)}>
              {(["composite", "headline", "component", "price", "unorthodox", "context"] as const).map((group) => (
                <optgroup key={group} label={group[0].toUpperCase() + group.slice(1)}>
                  {data.series.filter((series) => series.group === group && series.key !== "real_wage").map((series) => (
                    <option key={series.key} value={series.key}>{series.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <p className="field-note">
            Month-end snap · BEA metro RPP ({locationVintage})
            {metro.error && ` · Location error: ${metro.error}`}
          </p>
        </form>

        <div className="conversion-result" aria-live="polite">
          {conversion && !conversionError ? (
            <>
              <span>{currency(Number(amount) || 0)} →</span>
              <strong>{currency(conversion.result)}</strong>
              <p>
                {fromPlace?.label} · {formatMonth(conversion.fromMonth)}
                <br />
                {toPlace?.label} · {formatMonth(conversion.toMonth)}
                <br />
                {conversion.factor.toFixed(3)}× total
                {" · "}time {conversion.timeFactor.toFixed(3)}×
                {" · "}place {conversion.spatialFactor.toFixed(3)}×
              </p>
              <button className="copy-button" onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</button>
            </>
          ) : (
            <p className="error-message">{conversionError}</p>
          )}
        </div>
      </div>

      {conversion && (
        <div className="sparkline-wrap">
          <TimeSeriesChart
            months={data.months}
            compact
            height={140}
            lines={[{
              key: seriesKey,
              label: selected?.label ?? seriesKey,
              values: rebaseSeries(data.months, values, fromDate),
              color: SERIES_COLORS[seriesKey] ?? "#2563eb",
            }]}
            markers={[
              { month: conversion.fromMonth, label: "From" },
              { month: conversion.toMonth, label: "To" },
            ]}
          />
        </div>
      )}

      <aside className="formula-note">
        <code>amount × (time-to ÷ time-from) × (location-to ÷ location-from)</code>
        <p>{selected?.label} · BEA {locationVintage} RPP · no daily or live local precision.</p>
      </aside>
    </section>
  );
}

function Weights({
  data,
  cpiWeights,
  livedWeights,
  onSaveCpi,
  onSaveLived,
  onResetCpi,
  onResetLived,
}: {
  data: InflationData;
  cpiWeights: WeightMap;
  livedWeights: WeightMap;
  onSaveCpi: (weights: WeightMap) => void;
  onSaveLived: (weights: WeightMap) => void;
  onResetCpi: () => void;
  onResetLived: () => void;
}) {
  const [mode, setMode] = useState<"lived" | "cpi">("lived");
  const weights = mode === "lived" ? livedWeights : cpiWeights;
  const save = mode === "lived" ? onSaveLived : onSaveCpi;
  const reset = mode === "lived" ? onResetLived : onResetCpi;
  const components = data.series.filter((series) => series.group === "component");
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);

  return (
    <section className="page weights-page">
      <div className="page-title">
        <h1>Weights</h1>
        <p>Percentages or dollars—only proportions matter. Saved on this device.</p>
      </div>
      <div className="weights-toolbar">
        <div className="segmented">
          <button className={mode === "lived" ? "active" : ""} onClick={() => setMode("lived")}>Lived</button>
          <button className={mode === "cpi" ? "active" : ""} onClick={() => setMode("cpi")}>CPI-style</button>
        </div>
        <span>Total <strong>{total.toFixed(2)}</strong></span>
        <button onClick={reset}>Reset</button>
      </div>
      <div className="weights-list">
        {components.map((series) => (
          <label key={series.key}>
            <span>
              <strong>{series.label}</strong>
              {series.note && <small>{series.note}</small>}
            </span>
            <input
              type="number"
              min="0"
              step="0.001"
              value={weights[series.key] ?? 0}
              onChange={(event) => save({ ...weights, [series.key]: Math.max(0, Number(event.target.value) || 0) })}
              aria-label={`${series.label} weight`}
            />
          </label>
        ))}
      </div>
      <p className="weights-explain">
        Weighted geometric mean: EXP(Σ w × LN(coef) ÷ Σ w). Updates charts and Converter immediately.
      </p>
    </section>
  );
}

function Sources({ data }: { data: InflationData }) {
  const grouped = data.series
    .filter((series) => series.source !== "Calculated from component series")
    .reduce((groups, series) => {
      const group = groups.get(series.group) ?? [];
      group.push(series);
      groups.set(series.group, group);
      return groups;
    }, new Map<string, SeriesMeta[]>());
  return (
    <section className="page sources-page">
      <div className="page-title">
        <h1>Sources</h1>
        <p>Acronyms, dataset links, limits, and per-series provenance.</p>
      </div>

      <section className="source-section" aria-labelledby="acronyms-heading">
        <h2 id="acronyms-heading">Acronyms</h2>
        <dl className="acronym-list">
          {ACRONYMS.map((item) => (
            <div key={item.term}>
              <dt>{item.term}</dt>
              <dd>{item.expansion}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="source-section" aria-labelledby="bibliography-heading">
        <h2 id="bibliography-heading">Bibliography</h2>
        <ol className="bibliography-list">
          {BIBLIOGRAPHY.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.title}</strong>
              <span>{entry.publisher}</span>
              <a href={entry.url} target="_blank" rel="noreferrer">{entry.url}</a>
              {entry.note && <small>{entry.note}</small>}
            </li>
          ))}
        </ol>
      </section>

      <section className="source-section" aria-labelledby="reliability-heading">
        <h2 id="reliability-heading">Limits</h2>
        {RELIABILITY_NOTES.map((note) => (
          <article className="reliability-note" key={note.title}>
            <h3>{note.title}</h3>
            <p>{note.body}</p>
          </article>
        ))}
      </section>

      {[...grouped.entries()].map(([group, series]) => (
        <section className="source-group" key={group}>
          <h2>{group[0].toUpperCase() + group.slice(1)}</h2>
          {series.map((item: SeriesMeta) => (
            <details key={item.key}>
              <summary>
                <span>{item.label}</span>
                <small>{item.seriesId || "Calculated"}</small>
              </summary>
              <div>
                <p><strong>Source:</strong> {item.source}</p>
                <p><strong>Frequency:</strong> {item.frequency} · <strong>Units:</strong> {item.units}</p>
                {item.note && <p>{item.note}</p>}
                {item.url && <a href={item.url} target="_blank" rel="noreferrer">Source ↗</a>}
              </div>
            </details>
          ))}
        </section>
      ))}
      <div className="method-note">
        <h2>Treatment</h2>
        <p>{data.meta.method} Sparse months are interpolated; late water/milk series are spliced to related BLS indexes. Spatial coefficients stay cross-sectional at survey vintage and multiply time ratios—they do not replace them. See Data_Notes in the workbook.</p>
      </div>
    </section>
  );
}
