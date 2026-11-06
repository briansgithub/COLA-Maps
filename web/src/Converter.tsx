import { useEffect, useMemo, useState } from "react";
import { convertAmountWithLocation, formatMonth, getLevelSeries, monthKey, rebaseSeries, seriesRange, type InflationData, type WeightMap } from "./data";
import { TimeSeriesChart } from "./TimeSeriesChart";
import { coefficientVintage, formatLocationLabel } from "./coeffMap/vintage";
import { getCoef } from "./coeffMap/scale";
import { useCoeffData } from "./coeffMap/useCoeffData";
import { LocationSelect, type LocationChoice } from "./LocationSelect";
const SERIES_COLORS: Record<string, string> = {
  cpi: "#0f172a",
  pce: "#64748b",
  composite_cpi: "#c2410c",
  composite_lived: "#2563eb",
};

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

interface LocationOption extends LocationChoice { coefficient: number; }
export default function Converter({
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
  const [seriesKey, setSeriesKey] = useState("cpi");
  const [fromLocation, setFromLocation] = useState("__median__");
  const [toLocation, setToLocation] = useState("__median__");
  const [locationsEnabled, setLocationsEnabled] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [copyError, setCopyError] = useState("");
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
    if (!amount.trim() || !Number.isFinite(Number(amount))) throw new Error("Enter a valid dollar amount.");
    if (!fromDate || !toDate) throw new Error("Choose both dates.");
    if (!fromPlace || !toPlace) throw new Error("Select both an origin and destination location.");
    conversion = convertAmountWithLocation(
      Number(amount),
      fromDate,
      toDate,
      data.months,
      values,
      locationsEnabled ? fromPlace.coefficient : 1,
      locationsEnabled ? toPlace.coefficient : 1,
    );
  } catch (reason) {
    conversionError = reason instanceof Error ? reason.message : "Conversion unavailable.";
  }
  const selected = data.series.find((series) => series.key === seriesKey);
  const copyText = conversion
    ? `${currency(Number(amount))} in ${locationsEnabled ? fromPlace?.label : "US"}, ${formatMonth(conversion.fromMonth)} ≈ ${currency(conversion.result)} in ${locationsEnabled ? toPlace?.label : "US"}, ${formatMonth(conversion.toMonth)}. Time factor ${conversion.timeFactor.toFixed(3)}× using ${selected?.label}; location factor ${conversion.spatialFactor.toFixed(3)}× using BEA 2024 RPP.`
    : "";

  const copy = async () => {
    try { await navigator.clipboard.writeText(copyText); setCopyError(""); } catch { setCopyError("Could not copy. Select the result to copy it manually."); return; }
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
        <h1>Convert dollars</h1>
        <p>Find the equivalent purchasing power in another month or year.</p>
      </div>

      <div className="preset-row" aria-label="Date presets">
        <button onClick={() => presets("birth")}>1995 → latest</button>
        <button onClick={() => presets("reverse")}>Latest → 1995</button>
        <button onClick={() => presets("year")}>Past year</button>
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
          <button type="button" className="text-button" aria-expanded={locationsEnabled} aria-controls="location-controls" onClick={() => setLocationsEnabled(!locationsEnabled)}>{locationsEnabled ? "Remove locations" : "+ Add locations"}</button>
          {locationsEnabled && <div className="location-pair" id="location-controls">
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
          </div>}
          <details className="disclosure" open={advanced} onToggle={event => setAdvanced(event.currentTarget.open)}><summary>Advanced</summary><label>
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
          </label><p className="field-note">Using {data.series.find(item => item.key === seriesKey)?.label}.</p></details>
          <p className="field-note">
            Monthly data{locationsEnabled && <> · Metro price levels from {locationVintage}</>}
            {locationsEnabled && metro.error && ` · Location error: ${metro.error}`}
          </p>
        </form>

        <div className="conversion-result" aria-live="polite">
          {conversion && !conversionError ? (
            <>
              <span>{currency(Number(amount) || 0)} →</span>
              <strong>{currency(conversion.result)}</strong>
              <p>
                {locationsEnabled && <>{fromPlace?.label} · </>}{formatMonth(conversion.fromMonth)}
                <br />
                {locationsEnabled && <>{toPlace?.label} · </>}{formatMonth(conversion.toMonth)}
                <br />
                {conversion.factor.toFixed(3)}× total
                {locationsEnabled && <> · time {conversion.timeFactor.toFixed(3)}× · place {conversion.spatialFactor.toFixed(3)}×</>}
              </p>
              <p>{selected?.label}</p>
              {copyError && <p role="status">{copyError}</p>}
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

      <details className="disclosure"><summary>How this is calculated</summary><aside className="formula-note">
        <code>amount × (time-to ÷ time-from) × (location-to ÷ location-from)</code>
        <p>{selected?.label} · BEA {locationVintage} RPP · no daily or live local precision.</p>
      </aside></details>
    </section>
  );
}
