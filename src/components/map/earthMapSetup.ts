import { useEffect, useRef } from 'react';
import maplibregl, { type LayerSpecification, type Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl';
import type { LngLat } from '@/types';
import { BASEMAPS, GLOBAL_VIEW, type BasemapDefinition, type BasemapId } from '@/store/mapStore';

/** True when the browser can actually create a WebGL context for MapLibre. */
export function isWebglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    );
  } catch {
    return false;
  }
}

export function availableBasemaps(): BasemapDefinition[] {
  return Object.values(BASEMAPS);
}

export function resolveBasemap(id: BasemapId): BasemapDefinition {
  return BASEMAPS[id] ?? BASEMAPS.satellite;
}

const LABEL_TILES = ['https://basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png'];
const TERRAIN_TILES = ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'];

export interface BuildStyleOptions {
  basemap: BasemapDefinition;
  labelsVisible: boolean;
}

/** Deep-space backdrop + atmosphere tuned to the AgriSense palette. */
const SKY: StyleSpecification['sky'] = {
  'sky-color': '#020d05',
  'sky-horizon-blend': 0.5,
  'horizon-color': '#0b4a37',
  'horizon-fog-blend': 0.6,
  'fog-color': '#01392b',
  'fog-ground-blend': 0.85,
  'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 6, 0.35, 9, 0],
};

/**
 * Build a self-contained raster style — no external style JSON, no API key.
 * Used for satellite, terrain, streets and GIBS layers.
 */
export function buildRasterStyle({ basemap, labelsVisible }: BuildStyleOptions): StyleSpecification {
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
      { id: 'background', type: 'background', paint: { 'background-color': '#020d05' } },
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
    sky: SKY,
  };
}

/** Deep, agricultural vector palette applied over the OpenFreeMap source. */
const VECTOR_TINTS: Record<string, string> = {
  background: '#f6f5ea',
  water: '#c9dfe0',
  landcover: '#e3ead0',
  landuse: '#e6ecd6',
  park: '#dcebc6',
  building: '#e2ddd2',
  road: '#ffffff',
  boundary: '#c9c6b8',
};

/**
 * Build a vector style from the keyless OpenFreeMap source. The tint overlay
 * keeps OpenStreetMap legible while giving the map an AgriSense identity.
 */
export function buildVectorStyle(basemap: BasemapDefinition, labelsVisible: boolean): StyleSpecification {
  const base = basemap.styleUrl ?? 'https://tiles.openfreemap.org/styles/positron';
  return {
    version: 8,
    name: 'AgriSense Vector',
    // MapLibre resolves glyph/sprite URLs relative to the base style URL.
    glyphs: `${base.replace(/\/styles\/.*$/, '')}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution: basemap.attribution,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': VECTOR_TINTS.background } },
      {
        id: 'landcover',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        paint: { 'fill-color': VECTOR_TINTS.landcover, 'fill-opacity': 0.7 },
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        paint: { 'fill-color': VECTOR_TINTS.landuse, 'fill-opacity': 0.55 },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': VECTOR_TINTS.water },
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        paint: { 'line-color': VECTOR_TINTS.water, 'line-width': 1.2 },
      },
      {
        id: 'building',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 13,
        paint: { 'fill-color': VECTOR_TINTS.building, 'fill-opacity': 0.8 },
      },
      {
        id: 'boundary',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        paint: { 'line-color': VECTOR_TINTS.boundary, 'line-width': 0.8, 'line-dasharray': [3, 2] },
      },
      {
        id: 'road',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        minzoom: 6,
        paint: {
          'line-color': [
            'match',
            ['get', 'class'],
            ['motorway', 'trunk', 'primary'],
            '#f2e3b0',
            ['secondary', 'tertiary'],
            '#f6f5ea',
            VECTOR_TINTS.road,
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 12, 1.6, 16, 3.4],
        },
      },
      ...(labelsVisible ? [placeLabelLayer] : []),
    ],
    sky: SKY,
  };
}

const placeLabelLayer = {
  id: 'place-label',
  type: 'symbol',
  source: 'openmaptiles',
  'source-layer': 'place',
  minzoom: 3,
  layout: {
    'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
    'text-font': ['Noto Sans Regular'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 10, 13],
    'text-max-width': 8,
  },
  paint: {
    'text-color': '#01392b',
    'text-halo-color': 'rgba(246,245,234,0.9)',
    'text-halo-width': 1.2,
  },
} as unknown as LayerSpecification;

export function buildStyle(options: BuildStyleOptions): StyleSpecification {
  return options.basemap.kind === 'vector'
    ? buildVectorStyle(options.basemap, options.labelsVisible)
    : buildRasterStyle(options);
}

export interface UseEarthMapOptions {
  container: HTMLElement | null;
  basemap: BasemapId;
  labelsVisible: boolean;
  /** Start in globe projection (default true). */
  globe?: boolean;
  onReady?: (map: MapLibreMap) => void;
  onCursorMove?: (coord: LngLat | null) => void;
  onZoomChange?: (zoom: number) => void;
  /** Fired when the map cannot be created (e.g. WebGL unavailable). */
  onFailure?: () => void;
}

/**
 * Create and own the MapLibre map instance for the lifetime of the container.
 * The map is created exactly once; basemap and label changes are applied in place.
 */
export function useEarthMap(options: UseEarthMapOptions): React.MutableRefObject<MapLibreMap | null> {
  const mapRef = useRef<MapLibreMap | null>(null);
  const handlers = useRef(options);
  handlers.current = options;

  const { container, basemap, labelsVisible, globe = true } = options;

  useEffect(() => {
    if (!container || mapRef.current) return;
    if (!isWebglAvailable()) {
      handlers.current.onFailure?.();
      return;
    }

    const definition = resolveBasemap(basemap);
    const style = buildStyle({ basemap: definition, labelsVisible });

    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
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
    } catch {
      handlers.current.onFailure?.();
      return;
    }

    mapRef.current = map;

    const applyProjection = (): void => {
      try {
        map.setProjection({ type: globe ? 'globe' : 'mercator' });
      } catch {
        /* Older renderers fall back to Mercator automatically. */
      }
    };

    map.on('load', () => {
      applyProjection();
      handlers.current.onReady?.(map);
    });
    map.on('style.load', applyProjection);
    map.on('error', (event) => {
      // A failed WebGL context surfaces here on some drivers.
      const message = String((event as { error?: Error }).error?.message ?? '');
      if (/webgl|context/i.test(message)) handlers.current.onFailure?.();
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

  // Swap the basemap in place without rebuilding the map (handles raster <-> vector).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const definition = resolveBasemap(basemap);

    const swap = (): void => {
      map.setStyle(buildStyle({ basemap: definition, labelsVisible: handlers.current.labelsVisible }), {
        diff: false,
      });
      map.once('style.load', () => {
        try {
          map.setProjection({ type: globe ? 'globe' : 'mercator' });
        } catch {
          /* keep Mercator */
        }
      });
    };

    if (map.isStyleLoaded()) swap();
    else map.once('load', swap);
  }, [basemap, globe]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const visibility = labelsVisible ? 'visible' : 'none';
    if (map.getLayer('labels')) map.setLayoutProperty('labels', 'visibility', visibility);
    if (map.getLayer('place-label')) map.setLayoutProperty('place-label', 'visibility', visibility);
  }, [labelsVisible]);

  return mapRef;
}

export { TERRAIN_TILES };
