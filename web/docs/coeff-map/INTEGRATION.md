# Integrating into the Vite 8 + React 19 + TypeScript PWA

Target app layout (from the host project):

- App root: `web/`
- Entry: `web/src/main.tsx`, `web/src/App.tsx`
- Static data: `web/public/data/inflation.json`
- Tabs: Explore | Converter | Weights | Sources
- Charts: `echarts` + `echarts-for-react` (already present)
- Fonts: Fraunces + IBM Plex Sans via `@fontsource`
- PWA: `vite-plugin-pwa`

**No new npm dependencies** are required for the map component (uses ECharts `registerMap` + map series).

## 1. Copy files

From this package into the app:

```text
public/data/coeff-map/     →  web/public/data/coeff-map/
src/coeffMap/              →  web/src/coeffMap/
public/maps/coeff-map/     →  web/public/maps/coeff-map/   # optional iframe demo
docs/                      →  web/docs/coeff-map/          # optional
```

Example:

```bash
cp -R public/data/coeff-map web/public/data/
cp -R src/coeffMap web/src/
cp -R public/maps/coeff-map web/public/maps/   # optional
```

## 2. Component API

```tsx
import {
  CoeffMap,
  scaleSalary,
  toUsAverageBase,
  toReferencePlaceBase,
  combineSpatialAndTemporal,
  useCoeffData,
  type CoeffMapProps,
} from './coeffMap';
```

### `<CoeffMap />` props

| Prop | Type | Default | Description |
|---|---|---|---|
| `grain` | `'metro' \| 'county' \| 'place'` | required | Geography layer |
| `index` | `'bea' \| 'acs' \| 'hud' \| 'avg_simple' \| 'avg_weighted' \| 'housing' \| …` | required | Which index |
| `metric` | `'coef' \| 'raw'` | `'coef'` | Color by coefficient or raw value |
| `focusRegion` | `'la' \| 'nyc' \| 'nj' \| 'denver_boulder' \| 'north_alabama' \| 'all' \| null` | `null` | Filter place/county |
| `baselineGeoid` | `string \| null` | `null` | Rebase coefs so this GEOID = 1.00 |
| `onSelect` | `(record, geoid) => void` | — | Click handler |
| `height` | `number \| string` | `480` | CSS height |
| `theme` | `CoeffTheme` | ledger defaults | Deep ink bg; teal &lt; 1; copper &gt; 1 |
| `showLegend` | `boolean` | `true` | Diverging legend |
| `className` | `string` | — | Wrapper class |

Hooks: `useCoeffData(grain)`, `useCoeffMeta()`, `useFilteredCoeffData(grain, focusRegion)` fetch from:

```text
import.meta.env.BASE_URL + 'data/coeff-map/...'
```

## 3. Usage examples

### Add a “Map” tab

```tsx
// In App.tsx tab union: 'Explore' | 'Converter' | 'Weights' | 'Sources' | 'Map'
import { useState } from 'react';
import { CoeffMap, type CoeffGrain, type CoeffIndex } from './coeffMap';

function MapTab() {
  const [grain, setGrain] = useState<CoeffGrain>('metro');
  const [index, setIndex] = useState<CoeffIndex>('bea');
  return (
    <div>
      {/* wire grain/index controls to match ledger UI */}
      <CoeffMap
        grain={grain}
        index={index}
        height="calc(100vh - 120px)"
        onSelect={(rec) => console.log(rec)}
      />
    </div>
  );
}
```

### Embed in Converter (salary scaling)

```tsx
import { CoeffMap, scaleSalary, getCoef } from './coeffMap';
import { useState } from 'react';

function ConverterWithMap({ salaryA }: { salaryA: number }) {
  const [from, setFrom] = useState<{ geoid: string; coef: number } | null>(null);
  const [to, setTo] = useState<{ geoid: string; coef: number } | null>(null);

  const scaled =
    from && to ? scaleSalary(salaryA, from.coef, to.coef) : null;

  return (
    <>
      <CoeffMap
        grain="metro"
        index="bea"
        height={360}
        onSelect={(rec, geoid) => {
          if (!rec || !geoid) return;
          const coef = rec.coef_bea;
          if (coef == null) return;
          if (!from) setFrom({ geoid, coef });
          else setTo({ geoid, coef });
        }}
      />
      {scaled != null && <p>PP-equivalent: {scaled.toFixed(0)}</p>}
    </>
  );
}
```

### Optional iframe standalone

```tsx
<iframe
  title="Coefficient map"
  src={`${import.meta.env.BASE_URL}maps/coeff-map/index.html`}
  style={{ width: '100%', height: 640, border: 0 }}
/>
```

## 4. vite-plugin-pwa / Workbox notes

Data files are large (especially `geo/place.geojson` ~0.75 MB, `county.json` ~1.6 MB, county geo ~1.4 MB). Prefer **runtime caching** for JSON/GeoJSON rather than precaching place geo.

Example `vite.config.ts` fragment:

```ts
VitePWA({
  workbox: {
    // Keep precache glob tight — do NOT precache place geo by default
    globPatterns: ['**/*.{js,css,html,ico,svg,woff2}', 'data/inflation.json'],
    runtimeCaching: [
      {
        urlPattern: ({ url }) =>
          url.pathname.includes('/data/coeff-map/') &&
          (url.pathname.endsWith('.json') || url.pathname.endsWith('.geojson')),
        handler: 'CacheFirst',
        options: {
          cacheName: 'coeff-map-data',
          expiration: {
            maxEntries: 16,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
})
```

Suggestions:

- Precache `meta.json` + `metro.json` + `geo/metro.geojson` only if you need offline metro on first visit.
- Lazy-load county/place when the user selects that grain.
- Exclude `maps/coeff-map/index.html` (~5 MB Leaflet bundle) from precache; runtime or network-only is fine.

## 5. Fonts

Do **not** load Inter or Google Fonts from the standalone Leaflet page into the React shell. The React `CoeffMap` defaults to:

```text
'IBM Plex Sans', system-ui, sans-serif
```

Override via `theme.fontFamily` to include Fraunces for titles if desired — use the app’s existing `@fontsource` imports already wired in `main.tsx`.

## 6. Theme (ledger)

Default theme avoids purple gradients and cream/terracotta:

- Background: deep ink `#0f172a`
- Surface: slate `#1e293b`
- Below 1.00: teal `#0d9488` → neutral
- Above 1.00: neutral → copper `#c2410c`
- Missing: `#334155`

Pass `theme={{ ... }}` to align with any app CSS variables.
