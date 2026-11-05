import { create } from 'zustand';
import type { LngLat, MapViewState, SearchResult } from '@/types';

export type BasemapId = 'satellite' | 'satellite-detail' | 'terrain' | 'streets' | 'openfreemap' | 'gibs';

export interface BasemapDefinition {
  id: BasemapId;
  label: string;
  /** Short label for compact pills. */
  short: string;
  description: string;
  /** Raster tile templates. Empty when `styleUrl` supplies a vector style. */
  tiles: string[];
  /** Vector style URL (OpenFreeMap — keyless). Takes precedence over `tiles`. */
  styleUrl?: string;
  attribution: string;
  maxZoom: number;
  tileSize: number;
  /** Honest category used for the "what am I looking at" label. */
  kind: 'satellite' | 'terrain' | 'streets' | 'vector';
}

/**
 * Keyless open basemaps. Nothing here requires an API key or a paid account:
 *
 * - Sentinel-2 cloudless (EOX) — true-colour 10 m satellite mosaic, CC BY-NC-SA.
 * - OpenFreeMap — OpenStreetMap vector tiles with a self-contained style, no key.
 * - EOX terrain-light — shaded relief.
 * - OpenStreetMap raster — road/settlement context (not imagery).
 */
export const BASEMAPS: Record<BasemapId, BasemapDefinition> = {
  satellite: {
    id: 'satellite',
    label: 'Sentinel-2 cloudless',
    short: 'Satellite',
    description: 'True-colour Sentinel-2 mosaic, 10 m nominal resolution',
    tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'],
    attribution: 'Imagery © ESA Copernicus Sentinel-2 cloudless by EOX',
    maxZoom: 16,
    tileSize: 256,
    kind: 'satellite',
  },
  'satellite-detail': {
    id: 'satellite-detail',
    label: 'Sentinel-2 2020',
    short: 'Sat 2020',
    description: 'Alternate Sentinel-2 cloudless epoch for change inspection',
    tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'],
    attribution: 'Imagery © ESA Copernicus Sentinel-2 cloudless by EOX',
    maxZoom: 16,
    tileSize: 256,
    kind: 'satellite',
  },
  openfreemap: {
    id: 'openfreemap',
    label: 'OpenFreeMap (vector)',
    short: 'Map',
    description: 'OpenStreetMap vector map — crisp labels at any zoom, no key',
    tiles: [],
    styleUrl: 'https://tiles.openfreemap.org/styles/positron',
    attribution: '© OpenFreeMap · © OpenStreetMap contributors',
    maxZoom: 20,
    tileSize: 512,
    kind: 'vector',
  },
  terrain: {
    id: 'terrain',
    label: 'Terrain relief',
    short: 'Terrain',
    description: 'Shaded relief for landform and slope reading',
    tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/terrain-light_3857/default/g/{z}/{y}/{x}.jpg'],
    attribution: 'Terrain © EOX',
    maxZoom: 16,
    tileSize: 256,
    kind: 'terrain',
  },
  gibs: {
    id: 'gibs',
    label: 'NASA GIBS (MODIS)',
    short: 'GIBS',
    description: 'NASA near-real-time true-colour imagery — coarse global coverage',
    tiles: [
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    ],
    attribution: 'Imagery © NASA EOSDIS GIBS (MODIS Terra)',
    maxZoom: 9,
    tileSize: 256,
    kind: 'satellite',
  },
  streets: {
    id: 'streets',
    label: 'OpenStreetMap',
    short: 'Streets',
    description: 'Road and settlement context (map data, not imagery)',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    tileSize: 256,
    kind: 'streets',
  },
};

/** Order shown in the layer switcher — satellite first, vector map second. */
export const BASEMAP_ORDER: BasemapId[] = [
  'satellite',
  'openfreemap',
  'satellite-detail',
  'terrain',
  'streets',
  'gibs',
];

interface MapState {
  view: MapViewState;
  /** True while the camera is in a global Earth (globe) framing. */
  isGlobalView: boolean;
  basemap: BasemapId;
  projection: 'globe' | 'mercator';
  labelsVisible: boolean;
  terrainVisible: boolean;
  cursor: LngLat | null;
  zoom: number;
  /** Set when WebGL is unavailable and the raster fallback is in use. */
  webglUnavailable: boolean;
  setView: (view: Partial<MapViewState>) => void;
  setZoom: (zoom: number) => void;
  setCursor: (coord: LngLat | null) => void;
  setGlobalView: (isGlobal: boolean) => void;
  setBasemap: (basemap: BasemapId) => void;
  setProjection: (projection: 'globe' | 'mercator') => void;
  toggleLabels: () => void;
  toggleTerrain: () => void;
  setWebglUnavailable: (value: boolean) => void;
  flyToTarget: { coord: LngLat; zoom?: number; bbox?: [number, number, number, number]; nonce: number } | null;
  flyTo: (target: { coord: LngLat; zoom?: number; bbox?: [number, number, number, number] }) => void;
  resetToGlobe: () => void;
}

export const GLOBAL_VIEW: MapViewState = { center: { lng: 18, lat: 20 }, zoom: 1.5, bearing: 0, pitch: 0 };

export const useMapStore = create<MapState>((set) => ({
  view: GLOBAL_VIEW,
  isGlobalView: true,
  basemap: 'satellite',
  projection: 'globe',
  labelsVisible: true,
  terrainVisible: false,
  cursor: null,
  zoom: GLOBAL_VIEW.zoom,
  webglUnavailable: false,
  setView: (view) => set((state) => ({ view: { ...state.view, ...view } })),
  setZoom: (zoom) => set((state) => ({ zoom, isGlobalView: zoom < 2.4 ? state.isGlobalView : false })),
  setCursor: (cursor) => set({ cursor }),
  setGlobalView: (isGlobalView) => set({ isGlobalView }),
  setBasemap: (basemap) => set({ basemap }),
  setProjection: (projection) => set({ projection }),
  toggleLabels: () => set((state) => ({ labelsVisible: !state.labelsVisible })),
  toggleTerrain: () => set((state) => ({ terrainVisible: !state.terrainVisible })),
  setWebglUnavailable: (webglUnavailable) => set({ webglUnavailable }),
  flyToTarget: null,
  flyTo: (target) => set({ flyToTarget: { ...target, nonce: Date.now() } }),
  resetToGlobe: () =>
    set({ flyToTarget: { coord: GLOBAL_VIEW.center, zoom: GLOBAL_VIEW.zoom, nonce: Date.now() }, isGlobalView: true }),
}));

interface SearchState {
  query: string;
  results: SearchResult[];
  status: 'idle' | 'loading' | 'error' | 'empty';
  error: string | null;
  open: boolean;
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[]) => void;
  setStatus: (status: SearchState['status'], error?: string | null) => void;
  setOpen: (open: boolean) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  results: [],
  status: 'idle',
  error: null,
  open: false,
  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results, status: results.length ? 'idle' : 'empty' }),
  setStatus: (status, error = null) => set({ status, error }),
  setOpen: (open) => set({ open }),
}));
