# Scratch verification (Vite 8 + React 19 + TypeScript)

Ran in `/tmp/coeff-map-tsc`:

- `npx tsc --noEmit` — **pass** (0 errors) after GeoJSON ambient types + `mapReady` state fix
- `npx vite build` (vite **8.3.5**) — **pass**
- Headless Chromium (Playwright + system Chrome) screenshot → `docs/preview.png`

Dependencies installed for the scratch app only (not required in the host PWA beyond existing echarts):

- react@19, react-dom@19, echarts, echarts-for-react, typescript, vite@8, @vitejs/plugin-react, @types/geojson
