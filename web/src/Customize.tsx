import { useState } from "react";
import type { InflationData, WeightMap } from "./data";
export default function Weights({
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
        <h1>Customize your basket</h1>
        <p>Percentages or dollars—only proportions matter. Saved on this device.</p>
      </div>
      <div className="weights-toolbar">
        <div className="segmented">
          <button className={mode === "lived" ? "active" : ""} onClick={() => setMode("lived")}>Personal basket</button>
          <button className={mode === "cpi" ? "active" : ""} onClick={() => setMode("cpi")}>CPI-style</button>
        </div>
        <span>Total <strong>{total.toFixed(2)}</strong></span>
        <button onClick={reset}>Reset</button>
      </div>
      {[
        { title: "Food & housing", keys: ["food_home", "food_away", "rent", "oer", "home_prices", "furnishings"] },
        { title: "Utilities & transport", keys: ["electricity", "utility_gas", "water", "gasoline", "auto_ins", "new_cars", "used_cars", "car_repair", "public_transit"] },
        { title: "Health & everyday spending", keys: [] },
      ].map((group, index, groups) => <section className="basket-group" key={group.title}><h2>{group.title}</h2><div className="weights-list">
        {components.filter(series => index === 2 ? !groups.slice(0, 2).some(item => item.keys.includes(series.key)) : group.keys.includes(series.key)).map((series) => (
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
      </div></section>)}
      <p className="weights-explain">
        Weighted geometric mean: EXP(Σ w × LN(coef) ÷ Σ w). Updates charts and Converter immediately.
      </p>
    </section>
  );
}
