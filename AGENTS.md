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

## Gotchas

- `AnalysisTransition` runs the field analysis in an effect keyed on `field.id`.
  Keep it StrictMode-safe: do NOT add a `startedRef`-style one-shot guard — the
  first mount is aborted and the remount must re-run, or NDVI fetches get cancelled.
