# Dollar Since 1995

An installable, offline-ready PWA for exploring U.S. temporal inflation, spatial Cost of Living Adjustments, and converting dollar values between times/places. The repository also produces the source Excel workbook.

## Refresh the data

From the project root:

```powershell
python scripts/build_workbook.py --refresh
python scripts/verify_workbook.py
```

The first command downloads current BLS, FRED and public reference data, rebuilds `output/US_Dollar_Inflation_Coefficient.xlsx`, and writes the PWA payload to `web/public/data/inflation.json`. The verifier compares workbook formulas and exported web composites against the Python calculation.

Without `--refresh`, the builder uses the cached source responses under `data/raw/`.

## Run and test the PWA

```powershell
cd web
npm install
npm run dev
```

Open the printed local URL. To run all current checks:

```powershell
npm test
npm run build
npm run preview
```

The production bundle is written to `web/dist/`. It includes the inflation data, coefficient-map layers, manifest, icons, and service worker. The time series is precached; map layers are cached as they are visited so the large county and place files do not slow initial installation.

## Deploy to Cloudflare Pages

No backend or API keys are required.

1. Refresh and verify the data as shown above.
2. Run `npm run build` from `web/`.
3. In the Cloudflare dashboard, open **Workers & Pages → Create → Pages → Upload assets**.
4. Name the project (for example `dollar-since-1995`) and upload the entire `web/dist/` folder.
5. Open the generated HTTPS URL once on each device so the app and dataset are cached.

For a Git-connected Cloudflare Pages project, use:

- Root directory: `web`
- Build command: `npm run build`
- Build output directory: `dist`

The Python data refresh still runs locally; rebuild and redeploy `dist/` whenever the data changes.

## Install on a device

- **Android / Chrome:** open the deployed HTTPS site, then choose **Install app** (or Chrome menu → **Add to Home screen**).
- **iPhone / iPad:** open in Safari, tap **Share**, then **Add to Home Screen**.
- **Desktop Chrome / Edge:** click **Install app** in the site header or the browser address bar.

Personal basket weights are stored only in that browser’s `localStorage`; they are not uploaded or synchronized between devices.

## Data and calculation

The PWA consumes `web/public/data/inflation.json`, generated from the same `SPECS` definitions used by the workbook. Its custom composites use:

```text
EXP(sum(weight × LN(category coefficient)) / sum(weights))
```

The Converter combines a temporal coefficient with a BEA metro Regional Price Parity:

```text
amount
× (coefficient at destination month / coefficient at origin month)
× (coefficient at destination metro / coefficient at origin metro)
```

The app uses the observation for the selected month, or the nearest prior observation if that series has a gap. Metro purchasing-power coefficients are BEA 2024 data. Other Map-tab layers show their own vintage beside selected locations: county estimates are approximately 2021-centered, ACS rents cover 2019–2023, and HUD fair-market rents are FY2025. Spatial coefficients are cross-sectional and are not treated as January 1995 time indexes.
