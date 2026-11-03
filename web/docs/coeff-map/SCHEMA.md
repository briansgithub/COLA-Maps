# Coefficient map data schema

Package schema version: **1.0.0** (see `public/data/coeff-map/meta.json`).

## Geographic grains

| Grain | ID key | File | Coverage | Count |
|---|---|---|---|---|
| **metro** | CBSA code (5-digit string) | `metro.json` + `geo/metro.geojson` | Nationwide MSAs | 387 |
| **county** | County FIPS (5-digit string) | `county.json` + `geo/county.geojson` | Nationwide (experimental) | 3,143 data / 3,135 polygons |
| **place** | Census place GEOID (7-digit string) | `place.json` + `geo/place.geojson` | Focus regions only | 1,349 |

**Not included:** state layer, ZIP / ZCTA layer. Do not invent them from this package.

Focus regions (place layer): LA area, NYC metro, New Jersey, Denver/Boulder, North Alabama. County FIPS lists live in `meta.focusRegions`.

GeoJSON feature `id` and `properties.geoid` match the JSON object keys.

## Coefficient definition

\[
\mathrm{coefficient} = \frac{\mathrm{value}}{\mathrm{median\ across\ metros(index)}}
\]

| Index | Raw unit | Denominator (median metro) | Coef field |
|---|---|---|---|
| BEA RPP (all items) | Index, US average = 100 | **93.537** | `coef_bea` |
| ACS median gross rent | USD / month | **$1,091** | `coef_acs` |
| HUD FY2025 FMR 2BR | USD / month | **~$1,253** (`1252.997…`) | `coef_hud` |
| Average (simple) | mean of available coefs | — | `coef_avg_simple` |
| Average (weighted) | 0.50 BEA + 0.25 ACS + 0.25 HUD (renormalized if missing) | — | `coef_avg_weighted` |

So **1.000 = median metro** on every index. US-average BEA RPP remains 100 → coefficient ≈ **1.069** on the median base (`coef_vs_us = RPP/100` is also present on counties).

**Salary scaling (same grain + same index):**

\[
\mathrm{salary}_B = \mathrm{salary}_A \times \frac{\mathrm{coef}_B}{\mathrm{coef}_A}
\]

Prefer **BEA** for purchasing-power salary scaling. ACS/HUD are housing-only. Averages are exploratory only.

## Vintages / date ranges

| Source | Vintage |
|---|---|
| BEA MARPP metro | **2024** (release noted Feb 19, 2026) |
| OUSEA experimental county RPP | March 2024 release; constructed from **~2021**-centered public data |
| ACS median gross rent (B25064) | ACS 5-year **2023** (**2019–2023**) |
| ACS place population (B01003) | ACS 5-year 2023 |
| HUD FMR 2BR | **FY2025** |
| Metro/county population | Census Vintage **2025** |
| Boundaries | Census **2024** cartographic (simplified; coords rounded to 3 decimals in package geo) |

These are **spatial cross-sectional** indices at their survey year — **not** time-indexed to January 1995. See `docs/COEFFICIENTS.md`.

## Common fields (all grains)

| Field | Type | Meaning |
|---|---|---|
| `geoid` | string | Key (CBSA / FIPS / place GEOID) |
| `name` | string \| null | Display name |
| `state` | string \| null | State abbrev(s) or name |
| `region` | string \| null | Focus region label when applicable |
| `population` | number \| null | Population (vintage depends on grain) |
| `lat`, `lon` | number \| null | Centroid |
| `rpp_all_items` | number \| null | BEA/OUSEA/proxy all-items level (US=100 scale) |
| `coef_bea` | number \| null | All-items coef vs median metro |
| `acs_rent` | number \| null | Median gross rent (USD) |
| `coef_acs` | number \| null | ACS coef vs median metro ACS rent |
| `hud_fmr_2br` | number \| null | HUD 2BR FMR (USD) |
| `coef_hud` | number \| null | HUD coef vs median metro FMR |
| `coef_avg_simple` | number \| null | Unweighted mean of available coefs |
| `avg_simple_inputs` | string \| null | e.g. `BEA+ACS+HUD` |
| `coef_avg_weighted` | number \| null | Weighted mean of available coefs |
| `avg_weighted_inputs` | string \| null | Inputs used after renormalization |

## Metro-only fields

| Field | Meaning |
|---|---|
| `is_major` | Population ≥ 250k |
| `rpp_housing`, `coef_housing` | BEA housing (rents) |
| `rpp_goods`, `coef_goods` | BEA goods |
| `rpp_other_services`, `coef_other_services` | BEA other services |
| `rpp_utilities`, `coef_utilities` | BEA utilities |

## County-only fields

| Field | Meaning |
|---|---|
| `coef_vs_us` | `RPP / 100` |
| `is_focus` | In a focus region |
| `cbsa_code` | Containing CBSA when known |
| `data_source`, `rpp_year` | Provenance (OUSEA / ~2021) |

County BEA column is **OUSEA experimental All-items only** (no official BEA housing/goods/services at county).

## Place-only fields

| Field | Meaning |
|---|---|
| `regions` | Pipe-joined region tags (`nyc|nj`, …) |
| `county_fips`, `county_name` | Assigned county (centroid-in-polygon) |
| `rpp_housing`, `coef_housing` | Housing proxy |
| `rent_ratio` | place rent / county rent |
| `housing_weight_w` | 0.33 |
| `data_source` | Proxy description |

Place all-items proxy:

```
all_items_proxy = county_rpp × (1 − w) + county_rpp × w × (place_rent / county_rent)
housing_proxy   = county_rpp × (place_rent / county_rent)
```

with **w = 0.33**.

## Missing-data handling

- JSON fields are present but may be `null` when the source has no value (e.g. 5 Connecticut metros lack HUD joins after CT county→planning-region FIPS change; ACS suppression sentinels excluded at place build).
- Averages use **pairwise complete** inputs and renormalize weighted shares over the available subset.
- Map features with null coefs should render in the theme `missing` color (`#334155` default) and show "—" in tooltips.
- 8 legacy Connecticut county FIPS appear in `county.json` but have **no** 2024 Census polygons in `geo/county.geojson`.

## Caveats

1. **County RPPs are experimental** (OUSEA), ~2021 vintage — not an official U.S. government statistical product; will not match BEA 2024 metro when aggregated.
2. **Place values are rent-scaled proxies**, not official prices. Goods/services held at county via `(1−w)`.
3. **Averages are exploratory.** Do not substitute for BEA when scaling salaries for purchasing power.
4. **Year mix** across sources (2024 metro / ~2021 county / ACS 2019–2023 rents / HUD FY2025).
5. Puerto Rico is outside BEA/OUSEA RPP coverage.
6. Never mix a place or county baseline coefficient with a metro destination (compare like with like).
7. Spatial coefs are **not** Jan 1995 = 1.00 — combine explicitly with `inflation.json` time coefs (see `COEFFICIENTS.md`).

## Sources (URLs in meta.json)

- BEA MARPP: `https://apps.bea.gov/regional/zip/MARPP.zip`
- OUSEA county dataset + working paper (commerce.gov, March 2024)
- HUD FY2025 FMRs (huduser.gov)
- Census ACS 5-year 2023
