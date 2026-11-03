# Spatial coefficients vs the inflation app’s Jan 1995 base

## The crucial base issue

The coefficients in this package are **spatial cross-sectional** price levels:

- **1.00 = median metro** for that index at its survey year
- BEA metro all-items reference period ≈ **2024** (denominator RPP **93.537**)
- ACS rents are ACS 5-year **2019–2023**; HUD FMR is **FY2025**
- County OUSEA experimental ≈ **2021**-centered

They are **not** time-indexed to **January 1995 = 1.00**.

The existing inflation app’s `web/public/data/inflation.json` (or equivalent) carries **time** coefficients with Jan 1995 = 1.00. Do not treat a spatial coef as if it were already on that time base.

## Combining location and time

Let:

- \(\mathrm{CPI}(m)\) / \(\mathrm{CPI}(\mathrm{Jan1995})\) be the **time coefficient** from the inflation app (caller supplies — **this package does not invent CPI numbers**)
- \(\mathrm{coef}(p)\) be the **spatial** coefficient from this package (median metro = 1)
- \(\mathrm{coef}(p_{\mathrm{ref}})\) be the spatial coef of the reference place (often 1 if the dollar amount is already “national median metro” real dollars, or e.g. Huntsville 0.995)

Then a location-and-time-adjusted value is:

\[
\mathrm{value}(p, m) =
  \mathrm{base\_value}
  \times \frac{\mathrm{CPI}(m)}{\mathrm{CPI}(\mathrm{Jan1995})}
  \times \frac{\mathrm{coef}(p)}{\mathrm{coef}(p_{\mathrm{ref}})}
\]

In code (`src/coeffMap/scale.ts`):

```ts
import { combineSpatialAndTemporal, scaleSalary } from './coeffMap';

// timeCoef MUST come from inflation.json — do not hard-code CPI here
const adjusted = combineSpatialAndTemporal({
  baseValue: 100_000,
  timeCoef,           // CPI(month)/CPI(Jan1995)
  spatialCoef: coefB,
  referenceSpatialCoef: coefA,
});

// Pure spatial salary scaling (same month assumed):
const salaryB = scaleSalary(salaryA, coefA, coefB);
```

## Optional: renormalize to US average (BEA RPP 100)

Official BEA national all-items RPP is **100**. On the package’s median-metro base, that is approximately:

\[
\mathrm{coef}_{US} \approx 100 / 93.537 \approx 1.069
\]

To express a median-based coefficient on a **US-average = 1.00** base:

\[
\mathrm{coef}^{(\mathrm{US\ avg})} = \mathrm{coef}^{(\mathrm{median})} \times \frac{93.537}{100} = \frac{\mathrm{RPP}}{100}
\]

Helper: `toUsAverageBase(coefMedianMetro)`.

County rows also ship `coef_vs_us` (= RPP/100) precomputed.

## Rebase to a reference place

For UI “relative to Huntsville” views:

```ts
import { toReferencePlaceBase } from './coeffMap';
const relative = toReferencePlaceBase(coefBoulder, coefHuntsville);
// relative === 1.00 at Huntsville
```

`CoeffMap` accepts `baselineGeoid` to apply this visually when `metric="coef"`.

## Practical guidance

| Use case | What to use |
|---|---|
| PP salary across metros, same year | BEA `coef_bea`, `scaleSalary` |
| Housing-only rent comparison | ACS or HUD coefs (not full COL) |
| Blended exploratory view | `avg_simple` / `avg_weighted` — label as exploratory |
| Dollars across **time and** place | inflation time coef × spatial coef (formula above) |
| National-average base | `toUsAverageBase` or `coef_vs_us` |

**Do not** mix place/county baselines with metro destinations. Prefer metro BEA for salary PP.
