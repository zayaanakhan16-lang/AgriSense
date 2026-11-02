import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl';
import type { LngLat } from '@/types';
import { GLOBAL_VIEW, type BasemapId } from '@/store/mapStore';

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN ?? '').trim();
export const HAS_MAPBOX_TOKEN = MAPBOX_TOKEN.length > 0;

export interface RasterBasemap {
  id: string;
  label: string;
  description: string;
  tiles: string[];
  attribution: string;
  maxZoom: number;
  tileSize: number;
}

/** Mapbox satellite imagery served as plain raster tiles, so MapLibre can consume it. */
function mapboxSatellite(): RasterBasemap | null {
  if (!HAS_MAPBOX_TOKEN) return null;
  const suffix = `?access_token=${MAPBOX_TOKEN}`;
  return {
    id: 'mapbox-satellite',
    label: 'Mapbox Satellite',
    description: 'High-resolution commercial satellite imagery (Mapbox token detected)',
    tiles: [
      `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90${suffix}`,
    ],
    attribution: 'Imagery © Mapbox © Maxar',
    maxZoom: 20,
    tileSize: 512,
  };
}

const KEYLESS_BASEMAPS: Record<Exclude<BasemapId, 'satellite' | 'satellite-detail'>, RasterBasemap> = {
  terrain: {
    id: 'terrain',
    label: 'Terrain',
    description: 'Shaded relief for reading landform and slope',
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

function satelliteBasemaps(): RasterBasemap[] {
  const mapbox = mapboxSatellite();
  const eox2024: RasterBasemap = {
    id: 'satellite',
    label: 'Sentinel-2 cloudless 2024',
    description: 'True-colour Sentinel-2 mosaic, 10 m nominal resolution (ESA Copernicus)',
    tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'],
    attribution: 'Imagery © ESA Copernicus Sentinel-2 cloudless by EOX',
    maxZoom: 16,
    tileSize: 256,
  };
  const eox2020: RasterBasemap = {
    id: 'satellite-detail',
    label: 'Sentinel-2 cloudless 2020',
    description: 'Earlier Sentinel-2 cloudless epoch, useful for visual change comparison',
    tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'],
    attribution: 'Imagery © ESA Copernicus Sentinel-2 cloudless by EOX',
    maxZoom: 16,
    tileSize: 256,
  };
  return mapbox ? [mapbox, eox2024, eox2020] : [eox2024, eox2020];
}

export function availableBasemaps(): RasterBasemap[] {
  return [...satelliteBasemaps(), KEYLESS_BASEMAPS.terrain, KEYLESS_BASEMAPS.streets];
}

export function resolveBasemap(id: BasemapId): RasterBasemap {
  const all = availableBasemaps();
  return all.find((b) => b.id === id) ?? all[0];
}

const LABEL_TILES = ['https://basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png'];
const TERRAIN_TILES = ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'];

export interface BuildStyleOptions {
  basemap: RasterBasemap;
  labelsVisible: boolean;
}

/** Build a self-contained raster style — no external style JSON, no API key required. */
export function buildStyle({ basemap, labelsVisible }: BuildStyleOptions): StyleSpecification {
  return {
    version: 8,
    name: 'AgriSense Earth',
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      basemap: {
        type: 'raster',
        tiles: basemap.tiles,
        tileSize: basemap.tileSize,
        maxzoom: basemap.maxZoom,
        attribution: basemap.attribution,
      },
      ...(labelsVisible
        ? {
            labels: {
              type: 'raster' as const,
              tiles: LABEL_TILES,
              tileSize: 256,
              maxzoom: 18,
              attribution: 'Labels © CARTO © OpenStreetMap contributors',
            },
          }
        : {}),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#001F19' } },
      { id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-opacity': 1 } },
      ...(labelsVisible
        ? [
            {
              id: 'labels',
              type: 'raster' as const,
              source: 'labels',
              paint: { 'raster-opacity': 0.55 },
            },
          ]
        : []),
    ],
    sky: {
      'sky-color': '#0A2A22',
      'sky-horizon-blend': 0.7,
      'horizon-color': '#0E5F49',
      'horizon-fog-blend': 0.6,
      'fog-color': '#003B2F',
      'fog-ground-blend': 0.85,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 6, 0.35, 9, 0],
    },
  };
}

export interface UseEarthMapOptions {
  container: HTMLElement | null;
  basemap: BasemapId;
  labelsVisible: boolean;
  onReady?: (map: MapLibreMap) => void;
  onCursorMove?: (coord: LngLat | null) => void;
  onZoomChange?: (zoom: number) => void;
}

/** Create and own the MapLibre map instance for the lifetime of the container. */
export function useEarthMap(options: UseEarthMapOptions): React.MutableRefObject<MapLibreMap | null> {
  const mapRef = useRef<MapLibreMap | null>(null);
  const handlers = useRef(options);
  handlers.current = options;

  const { container, basemap, labelsVisible } = options;

  useEffect(() => {
    if (!container || mapRef.current) return;

    const style = buildStyle({ basemap: resolveBasemap(basemap), labelsVisible });
    const map = new maplibregl.Map({
      container,
      style,
      center: [GLOBAL_VIEW.center.lng, GLOBAL_VIEW.center.lat],
      zoom: GLOBAL_VIEW.zoom,
      attributionControl: { compact: true },
      maxPitch: 85,
      minZoom: 0.4,
      maxZoom: 19,
      dragRotate: true,
      pitchWithRotate: false,
      touchPitch: true,
      canvasContextAttributes: { antialias: true },
    });

    mapRef.current = map;

    map.on('load', () => {
      try {
        map.setProjection({ type: 'globe' });
      } catch {
        /* Older renderers fall back to Mercator automatically. */
      }
      handlers.current.onReady?.(map);
    });

    const handleMove = (event: { lngLat: { lng: number; lat: number } }): void => {
      handlers.current.onCursorMove?.({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    };
    map.on('mousemove', handleMove);
    map.on('mouseout', () => handlers.current.onCursorMove?.(null));
    map.on('zoom', () => handlers.current.onZoomChange?.(map.getZoom()));

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      map.off('mousemove', handleMove);
      map.remove();
      mapRef.current = null;
    };
    // The map instance is intentionally created once; style changes are applied separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container]);

  // Swap the basemap in place without rebuilding the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const resolved = resolveBasemap(basemap);
    const source = map.getSource('basemap') as maplibregl.RasterTileSource | undefined;
    if (!source) return;
    const currentTiles = source.tiles?.[0];
    if (currentTiles === resolved.tiles[0]) return;
    map.removeLayer('basemap');
    map.removeSource('basemap');
    map.addSource('basemap', {
      type: 'raster',
      tiles: resolved.tiles,
      tileSize: resolved.tileSize,
      maxzoom: resolved.maxZoom,
      attribution: resolved.attribution,
    });
    const labelsId = map.getLayer('labels') ? 'labels' : undefined;
    map.addLayer(
      { id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-opacity': 1 } },
      labelsId,
    );
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const visibility = labelsVisible ? 'visible' : 'none';
    if (map.getLayer('labels')) map.setLayoutProperty('labels', 'visibility', visibility);
  }, [labelsVisible]);

  return mapRef;
}

export { TERRAIN_TILES };
