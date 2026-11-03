import { useEffect, useState } from "react";
import {
  annualizedRate,
  convertAmount,
  defaultWeights,
  formatMonth,
  geometricComposite,
  getCoefficientSeries,
  loadData,
  type CompositeKind,
  type InflationData,
  type SeriesMeta,
  type WeightMap,
} from "./data";
import { TimeSeriesChart, type ChartLine } from "./TimeSeriesChart";

type Tab = "explore" | "converter" | "weights" | "sources";

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
    description: "Observed dollar prices, normalized to January 1995, rather than broad category indexes.",
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
  cpi: "#183f53",
  pce: "#6e8390",
  composite_cpi: "#d07a36",
  composite_lived: "#167f77",
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

function seriesLabel(data: InflationData, key: string): string {
  return data.series.find((series) => series.key === key)?.label ?? key;
}

function makeLines(
  data: InflationData,
  keys: string[],
  cpiWeights: WeightMap,
  livedWeights: WeightMap,
): ChartLine[] {
  return keys.map((key) => ({
    key,
    label: seriesLabel(data, key),
    values: getCoefficientSeries(data, key, cpiWeights, livedWeights),
    color: SERIES_COLORS[key],
    width: key === "cpi" ? 3 : undefined,
  }));
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
    return ["explore", "converter", "weights", "sources"].includes(hash) ? (hash as Tab) : "explore";
  });
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [updateApp, setUpdateApp] = useState<(() => Promise<void>) | null>(null);
  const cpi = useWeights(data, "composite_cpi");
  const lived = useWeights(data, "composite_lived");

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
        <p>Loading thirty-one years of prices…</p>
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
          {(["explore", "converter", "weights", "sources"] as Tab[]).map((item) => (
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
          <Explore data={data} cpiWeights={cpi.weights} livedWeights={lived.weights} onConvert={() => selectTab("converter")} />
        )}
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
        <p>Public economic data, translated into everyday purchasing power.</p>
        <p>Data through {formatMonth(data.meta.latestMonth)} · Retrieved {data.meta.retrieved}</p>
      </footer>
    </>
  );
}

function Explore({
  data,
  cpiWeights,
  livedWeights,
  onConvert,
}: {
  data: InflationData;
  cpiWeights: WeightMap;
  livedWeights: WeightMap;
  onConvert: () => void;
}) {
  const latestIndex = data.months.length - 1;
  const official = data.coefficients.cpi[latestIndex] ?? 0;
  const pce = data.coefficients.pce[latestIndex] ?? 0;
  const cpiComposite = geometricComposite(data, cpiWeights);
  const livedComposite = geometricComposite(data, livedWeights);
  const livedLatest = livedComposite[latestIndex] ?? 0;
  const rate = annualizedRate(livedLatest, data.meta.baseMonth, data.meta.latestMonth);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Your dollar, traced from January 1995</p>
          <h1>Dollar Since 1995</h1>
          <p className="hero-lede">
            Official inflation says one 1995 dollar now costs <strong>{official.toFixed(2)}×</strong> to replace.
            A basket that uses actual home prices says <strong>{livedLatest.toFixed(2)}×</strong>.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={onConvert}>Convert a dollar value</button>
            <span>Updated through {formatMonth(data.meta.latestMonth)}</span>
          </div>
        </div>
        <div className="hero-number" aria-label={`Lived experience coefficient ${livedLatest.toFixed(2)} times`}>
          <span className="number-label">Lived-experience coefficient</span>
          <strong>{livedLatest.toFixed(2)}<small>×</small></strong>
          <span>{(rate * 100).toFixed(2)}% annualized since birth</span>
        </div>
      </section>

      <section className="metric-rail" aria-label="Latest inflation measures">
        <Metric label="Official CPI-U" value={`${official.toFixed(2)}×`} note={`${currency(1 / official)} purchasing power`} />
        <Metric label="PCE price index" value={`${pce.toFixed(2)}×`} note="Federal Reserve preference" />
        <Metric label="CPI-style basket" value={`${(cpiComposite[latestIndex] ?? 0).toFixed(2)}×`} note="Validates the method" />
        <Metric label="$1.00 then costs" value={currency(livedLatest)} note="Using your lived weights" />
      </section>

      <section className="chart-feature">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Four views of the same dollar</p>
            <h2>What changed since your birth?</h2>
          </div>
          <p>Drag the range below the chart. Hold Shift and scroll to zoom.</p>
        </div>
        <TimeSeriesChart
          months={data.months}
          zoom
          height={480}
          lines={[
            { key: "cpi", label: "Official CPI-U", values: data.coefficients.cpi, color: SERIES_COLORS.cpi },
            { key: "pce", label: "PCE price index", values: data.coefficients.pce, color: SERIES_COLORS.pce },
            { key: "composite_cpi", label: "CPI-style basket", values: cpiComposite, color: SERIES_COLORS.composite_cpi },
            { key: "composite_lived", label: "Lived-experience basket", values: livedComposite, color: SERIES_COLORS.composite_lived, width: 3 },
          ]}
        />
      </section>

      <section className="story-intro">
        <p className="eyebrow">Where the headline breaks apart</p>
        <h2>Inflation is not one line.</h2>
        <p>Housing, insurance, utilities and food moved at different speeds. These views show what the average hides.</p>
      </section>

      <div className="theme-charts">
        {THEME_GROUPS.map((group, index) => (
          <section className="theme-section" key={group.title}>
            <div className="theme-copy">
              <span className="section-number">{String(index + 1).padStart(2, "0")}</span>
              <h3>{group.title}</h3>
              <p>{group.description}</p>
            </div>
            <div className="theme-chart">
              <TimeSeriesChart
                months={data.months}
                lines={makeLines(data, group.keys, cpiWeights, livedWeights)}
                height={390}
              />
            </div>
          </section>
        ))}
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
  const [copied, setCopied] = useState(false);

  const values = getCoefficientSeries(data, seriesKey, cpiWeights, livedWeights);
  let conversion: ReturnType<typeof convertAmount> | null = null;
  let conversionError = "";
  try {
    conversion = convertAmount(Number(amount), fromDate, toDate, data.months, values);
  } catch (reason) {
    conversionError = reason instanceof Error ? reason.message : "Conversion unavailable.";
  }
  const selected = data.series.find((series) => series.key === seriesKey);
  const copyText = conversion
    ? `${currency(Number(amount))} in ${formatMonth(conversion.fromMonth)} ≈ ${currency(conversion.result)} in ${formatMonth(conversion.toMonth)}, using ${selected?.label}.`
    : "";

  const copy = async () => {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const presets = (type: "birth" | "reverse" | "year") => {
    if (type === "birth") {
      setFromDate(data.meta.birthDate);
      setToDate(latest);
    } else if (type === "reverse") {
      setFromDate(latest);
      setToDate(data.meta.birthDate);
    } else {
      const d = new Date(`${latest}T00:00:00`);
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      setFromDate(d.toISOString().slice(0, 10));
      setToDate(latest);
    }
  };

  return (
    <section className="page converter-page">
      <div className="page-title">
        <p className="eyebrow">Purchasing power, translated</p>
        <h1>Dollar converter</h1>
        <p>Compare what the same amount buys at two moments in time.</p>
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
              From date
              <input type="date" min={data.meta.birthDate} max={latest} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <button
              className="swap-button"
              type="button"
              onClick={() => {
                setFromDate(toDate);
                setToDate(fromDate);
              }}
              aria-label="Swap dates"
            >
              ⇄
            </button>
            <label>
              To date
              <input type="date" min={data.meta.birthDate} max={latest} value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
          </div>
          <label>
            Inflation measure
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
          <p className="field-note">Dates use the latest available monthly observation on or before the selected day.</p>
        </form>

        <div className="conversion-result" aria-live="polite">
          {conversion && !conversionError ? (
            <>
              <span>{currency(Number(amount) || 0)} becomes</span>
              <strong>{currency(conversion.result)}</strong>
              <p>
                {formatMonth(conversion.fromMonth)} → {formatMonth(conversion.toMonth)}
                <br />Factor: {conversion.factor.toFixed(3)}× using {selected?.label}
              </p>
              <button className="copy-button" onClick={() => void copy()}>{copied ? "Copied" : "Copy result"}</button>
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
            height={170}
            lines={[{ key: seriesKey, label: selected?.label ?? seriesKey, values, color: SERIES_COLORS[seriesKey] ?? "#167f77" }]}
            markers={[
              { month: conversion.fromMonth, label: "From" },
              { month: conversion.toMonth, label: "To" },
            ]}
          />
        </div>
      )}

      <aside className="formula-note">
        <strong>How it works</strong>
        <code>amount × (coefficient at destination ÷ coefficient at origin)</code>
        <p>The converter uses the same monthly series shown in Explore. It does not invent daily precision.</p>
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
        <p className="eyebrow">Make the index yours</p>
        <h1>Basket weights</h1>
        <p>Use percentages or monthly dollars. Only proportions matter; they do not have to total 100.</p>
      </div>
      <div className="segmented">
        <button className={mode === "lived" ? "active" : ""} onClick={() => setMode("lived")}>Lived experience</button>
        <button className={mode === "cpi" ? "active" : ""} onClick={() => setMode("cpi")}>CPI-style</button>
      </div>
      <div className="weights-toolbar">
        <span>Total weight: <strong>{total.toFixed(2)}</strong></span>
        <button onClick={reset}>Reset to defaults</button>
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
        The composite is a weighted geometric mean: EXP(Σ weight × LN(coefficient) ÷ Σ weight).
        Changes save automatically on this device and update both charts and Converter.
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
        <p className="eyebrow">Trace every line</p>
        <h1>Sources & methods</h1>
        <p>Every series links back to the publishing agency. Public data is not automatically perfect; these notes make its limits visible.</p>
      </div>
      <div className="trust-note">
        <strong>Why these sources?</strong>
        <p>BLS and BEA publish documented national statistics; FRED redistributes official series without altering them. Case-Shiller uses repeat home sales. The Economist, USPS and Farm Bureau lines are cross-checks—not substitutes for a broad price index.</p>
      </div>
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
                {item.url && <a href={item.url} target="_blank" rel="noreferrer">Open original source ↗</a>}
              </div>
            </details>
          ))}
        </section>
      ))}
      <div className="method-note">
        <h2>Data treatment</h2>
        <p>{data.meta.method} A small number of missing monthly observations are interpolated; late-starting water and milk series are spliced to closely related BLS indexes. Details remain in the spreadsheet’s Data_Notes sheet.</p>
      </div>
    </section>
  );
}
