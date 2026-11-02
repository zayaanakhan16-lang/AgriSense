import { create } from 'zustand';
import type { LngLat, MapViewState, SearchResult } from '@/types';

export type BasemapId = 'satellite' | 'satellite-detail' | 'terrain' | 'streets';

export interface BasemapDefinition {
  id: BasemapId;
  label: string;
  description: string;
  tiles: string[];
  attribution: string;
  maxZoom: number;
  tileSize: number;
}

/**
 * Keyless raster sources used by the MapLibre Earth stack. When a Mapbox token is
 * configured, the map prefers Mapbox's own satellite and globe styles instead.
 */
export const BASEMAPS: Record<BasemapId, BasemapDefinition> = {
  satellite: {
    id: 'satellite',
    label: 'Sentinel-2 cloudless',
    description: 'True-colour Sentinel-2 mosaic, 10 m nominal resolution',
    tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'],
    attribution: 'Imagery © ESA Copernicus Sentinel-2 cloudless by EOX',
    maxZoom: 16,
    tileSize: 256,
  },
  'satellite-detail': {
    id: 'satellite-detail',
    label: 'Sentinel-2 2020 (high detail)',
    description: 'Alternate Sentinel-2 cloudless epoch for change inspection',
    tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'],
    attribution: 'Imagery © ESA Copernicus Sentinel-2 cloudless by EOX',
    maxZoom: 16,
    tileSize: 256,
  },
  terrain: {
    id: 'terrain',
    label: 'Terrain',
    description: 'Shaded relief for landform and slope reading',
    tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/terrain-light_3857/default/g/{z}/{y}/{x}.jpg'],
    attribution: 'Terrain © EOX',
    maxZoom: 16,
    tileSize: 256,
  },
  streets: {
    id: 'streets',
    label: 'Streets',
    description: 'Road and settlement context from OpenStreetMap',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    tileSize: 256,
  },
};

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
  setView: (view: Partial<MapViewState>) => void;
  setZoom: (zoom: number) => void;
  setCursor: (coord: LngLat | null) => void;
  setGlobalView: (isGlobal: boolean) => void;
  setBasemap: (basemap: BasemapId) => void;
  setProjection: (projection: 'globe' | 'mercator') => void;
  toggleLabels: () => void;
  toggleTerrain: () => void;
  flyToTarget: { coord: LngLat; zoom?: number; bbox?: [number, number, number, number]; nonce: number } | null;
  flyTo: (target: { coord: LngLat; zoom?: number; bbox?: [number, number, number, number] }) => void;
  resetToGlobe: () => void;
}

export const GLOBAL_VIEW: MapViewState = { center: { lng: 20, lat: 22 }, zoom: 1.6, bearing: 0, pitch: 0 };

export const useMapStore = create<MapState>((set) => ({
  view: GLOBAL_VIEW,
  isGlobalView: true,
  basemap: 'satellite',
  projection: 'globe',
  labelsVisible: true,
  terrainVisible: false,
  cursor: null,
  zoom: GLOBAL_VIEW.zoom,
  setView: (view) => set((state) => ({ view: { ...state.view, ...view } })),
  setZoom: (zoom) => set((state) => ({ zoom, isGlobalView: zoom < 2.4 ? state.isGlobalView : false })),
  setCursor: (cursor) => set({ cursor }),
  setGlobalView: (isGlobalView) => set({ isGlobalView }),
  setBasemap: (basemap) => set({ basemap }),
  setProjection: (projection) => set({ projection }),
  toggleLabels: () => set((state) => ({ labelsVisible: !state.labelsVisible })),
  toggleTerrain: () => set((state) => ({ terrainVisible: !state.terrainVisible })),
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
