# AgriSense — repository notes for agents

Premium Earth-intelligence & agricultural-planning frontend. Frontend only: never
rebuild or alter backend contracts, do not add a second crop rules engine, and do
not hardcode secrets.

## Stack & layout

- React 18 + strict TypeScript + Vite + Tailwind + shadcn/ui (`src/components/ui`).
- MapLibre GL JS (`src/components/map`), Recharts (`src/components/charts`),
  Framer Motion, Lucide, jsPDF.
- Feature folders under `src/features/*`; state in `src/store/*` (zustand);
  network + domain logic in `src/services/*`; typed contracts in `src/types`.
- `@/*` path alias -> `src/*` (see `vite.config.ts` + `tsconfig.app.json`).

## Commands

- `npm run dev` — Vite dev server. In this environment it is run as
  `vite --host 0.0.0.0 --port 12000 --strictPort` (public preview on port 12000).
- `npm run typecheck` — `tsc --noEmit` (uses `tsconfig.app.json`).
- `npm run lint` — ESLint.
- `npm run build` — `tsc -b && vite build`. Requires `@types/node` (for `vite.config.ts`).

## Data sources (keyless by default)

- Basemap: EOX Sentinel-2 cloudless 2024 raster tiles (no key required).
- Vegetation: Sentinel-2 L2A COGs -> NDVI computed client-side via `geotiff`.
- Soil: ISRIC SoilGrids v2.0.
- Climate: Open-Meteo ERA5 archive + forecast.
- Crop rules: deterministic 68-profile rules engine (`src/services/rulesEngine.ts`).
- Optional `VITE_MAPBOX_TOKEN` swaps the basemap; optional `VITE_AGRISENSE_API_URL`
  points at an existing edge/rules API. Both absent -> keyless stack + labelled
  demonstration data. Never present demonstration numbers as live measurements.

## Known environment quirk

- The sandbox GL stack is ANGLE/SwiftShader (software). The MapLibre **globe
  projection renders correctly** but screenshots of the WebGL canvas come out
  blank/black. Verify globe rendering via an in-page `canvas.drawImage` readback
  (pixel histogram), not via screenshot. Mercator tiles capture fine.

## Region workspaces (Earth Explorer / Analytics / Crop Planning)

- `EarthWorkspace` (`src/features/earth/EarthWorkspace.tsx`) is the shared shell:
  the map/analytics surface fills the remaining width and the Region List sits in
  a fixed `w-[320px]` right column (hidden below `lg`), so the panel never
  overlaps the workspace. It renders the top-centre `MapAnalyticsToggle`.
- Routes: `/` (Earth Explorer), `/analytics` (Region Analytics),
  `/crop-profiles` (crop profile points), `/crop-plan` (intercropping + rotation
  + calendar). All four share the same Region List panel via `RegionPanel`.
- `RegionPanel` owns the edit dialog, delete confirm and zoom-to actions so the
  map and analytics screens behave identically.
- `RegionList` (`src/components/map/RegionList.tsx`) is the panel body: search,
  crop/type filter, Recent/Name/Area sort, region cards, count and empty state.
- Region drawing lives in `DrawingWorkspace`: place points on the map, `Enter`
  (or "Save region") opens `RegionDialog`, `Escape` (or Cancel) discards the ring.
  The keyboard handler in `EarthMap` ignores events from inputs and from an open
  `[role="dialog"]`, so Escape closes the dialog rather than the ring behind it.
- `MapToolbar` is the vertical left toolbar (basemap, zoom, view mode, draw,
  locate, labels, reset north). Pass `toolbar` to `EarthMap` to enable it; the
  older bottom-right controls are then hidden to avoid duplication.

## Demonstration analytics

- `src/services/regionAnalytics.ts` generates every Region Analytics value
  deterministically from the region centroid + area (seeded PRNG, no live calls).
  The page labels the whole workspace as demonstration data, and the Water Saved /
  Revenue Boost cards carry an explicit "Illustrative" badge.
- Never present these numbers as measured. If a real backend source is added,
  replace the builders rather than layering demo values on top.
- `src/lib/cropProfiles.ts` builds the crop-profile point grid inside a polygon:
  a bounding-box grid clipped with `pointInPolygon`, so points never leave the
  boundary. Categories are a spatial hash, so the legend/filters stay stable.

## Gotchas

- `AnalysisTransition` runs the field analysis in an effect keyed on `field.id`.
  Keep it StrictMode-safe: do NOT add a `startedRef`-style one-shot guard — the
  first mount is aborted and the remount must re-run, or NDVI fetches get cancelled.
- The Earth Explorer seeds one demonstration region (`DEMO_REGION_ID` in
  `src/data/regions.ts`) on first mount of an empty workspace so the map, panel
  and analytics have content. It is flagged `isSample` and badged "Demo".
