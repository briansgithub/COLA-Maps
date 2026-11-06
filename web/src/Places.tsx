import { useMemo, useState } from "react";
import { CoeffMap } from "./coeffMap/CoeffMap";
import { INDEX_LABEL } from "./coeffMap/types";
import { getCoef } from "./coeffMap/scale";
import { coefficientVintage, formatPlaceName } from "./coeffMap/vintage";
import { useCoeffMeta, useFilteredCoeffData } from "./coeffMap/useCoeffData";
import type { CoeffGrain, CoeffIndex, CoeffRecord, FocusRegion } from "./coeffMap/types";
import { LocationSelect, type LocationChoice } from "./LocationSelect";
const MAP_INDEXES: Record<CoeffGrain, CoeffIndex[]> = {
  metro: ["bea", "housing", "goods", "other_services", "utilities", "acs", "hud", "avg_weighted", "avg_simple"],
  county: ["bea", "acs", "hud", "avg_weighted", "avg_simple"],
  place: ["bea", "housing", "acs", "hud", "avg_weighted", "avg_simple"],
};

const GRAIN_CAVEAT: Record<CoeffGrain, string> = {
  metro: "Official BEA metro price levels.",
  county: "OUSEA experimental county estimates.",
  place: "Rent-scaled place proxy, not an official all-items index.",
};

function vsMedianPhrase(coef: number): string {
  const pct = Math.round((coef - 1) * 100);
  if (pct === 0) return "about the US median metro";
  if (pct > 0) return `${pct}% above median metro`;
  return `${Math.abs(pct)}% below median metro`;
}

export default function MapTab() {
  const [grain, setGrain] = useState<CoeffGrain>("metro");
  const [index, setIndex] = useState<CoeffIndex>("bea");
  const [focusRegion, setFocusRegion] = useState<FocusRegion>("all");
  const [selected, setSelected] = useState<CoeffRecord | null>(null);
  const { meta } = useCoeffMeta();
  const bundle = useFilteredCoeffData(grain, grain === "metro" ? null : focusRegion);
  const vintage = coefficientVintage(meta, grain, index);
  const selectedCoef = getCoef(selected, index);
  const searchNoun = grain === "metro" ? "metros" : grain === "county" ? "counties" : "places";
  const searchOptions = useMemo<LocationChoice[]>(() => {
    const options: LocationChoice[] = [];
    for (const record of Object.values(bundle.data ?? {})) {
      if (!record.name) continue;
      options.push({ geoid: record.geoid, label: formatPlaceName(record) });
    }
    options.sort((a, b) => a.label.localeCompare(b.label));
    return options;
  }, [bundle.data]);

  const changeGrain = (next: CoeffGrain) => {
    setGrain(next);
    setIndex("bea");
    setSelected(null);
  };

  const pickLocation = (geoid: string) => {
    if (!geoid) {
      setSelected(null);
      return;
    }
    setSelected(bundle.data?.[geoid] ?? null);
  };

  return (
    <section className="page map-page">
      <div className="page-title map-title">
        <h1>Compare places</h1>
        <p>Find a place to see how local costs compare with the US median metro.</p>
      </div>

        <LocationSelect
          key={`${grain}-${focusRegion}`}
          id="map-location-search"
          className="map-search"
          label="Find a place"
          value={selected?.geoid ?? ""}
          options={searchOptions}
          loading={bundle.loading}
          searchPlaceholder={`Filter ${searchNoun}`}
          emptyLabel={`Jump to a ${grain === "metro" ? "metro" : grain === "county" ? "county" : "place"}`}
          maxVisible={100}
          onChange={pickLocation}
        />

      <div className="map-selection" aria-live="polite">
        {selected ? (
          <>
            <div className="map-selection-head">
              <strong>{formatPlaceName(selected)}</strong>
              <button type="button" onClick={() => setSelected(null)}>Clear</button>
            </div>
            <p>
              {selectedCoef == null ? "No value available" : vsMedianPhrase(selectedCoef)}
              {selectedCoef != null && <> · {selectedCoef.toFixed(3)}× · {vintage}</>}
            </p>
            {selected.population != null && (
              <p>Population {selected.population.toLocaleString()}</p>
            )}
            <p className="map-selection-note">{GRAIN_CAVEAT[grain]}</p>
          </>
        ) : (
          <p>Click a region · search to jump · scroll to zoom · drag to pan</p>
        )}
      </div>
      <details className="disclosure map-options"><summary>Map options</summary><div className="map-controls" aria-label="Map controls">
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
          <select value={index} onChange={(event) => setIndex(event.target.value as CoeffIndex)}>
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
      </div></details>

      <CoeffMap
        grain={grain}
        index={index}
        focusRegion={focusRegion}
        selectedGeoid={selected?.geoid ?? null}
        height="clamp(400px, 58vh, 640px)"
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


    </section>
  );
}
