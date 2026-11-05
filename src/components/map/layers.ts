import type { Map as MapLibreMap } from 'maplibre-gl';
import type { CropZone, LngLat, NdviOverlayGeometry } from '@/types';
import { closeRing, toLineFeature, toPointFeature, toPolygonFeature } from '@/lib/geo';

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

type AnyFeature = GeoJSON.Feature<GeoJSON.Geometry>;

function collection(features: AnyFeature[]): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features };
}

function ensureSource(map: MapLibreMap, id: string): void {
  if (!map.getSource(id)) {
    map.addSource(id, { type: 'geojson', data: EMPTY });
  }
}

function ensureLayer(map: MapLibreMap, layer: Parameters<MapLibreMap['addLayer']>[0]): void {
  if (!map.getLayer(layer.id)) map.addLayer(layer);
}

function setData(map: MapLibreMap, id: string, data: GeoJSON.FeatureCollection): void {
  const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  source?.setData(data);
}

/* -------------------------------------------------------------------------- */
/* Layer registry                                                             */
/* -------------------------------------------------------------------------- */

export const LAYERS = {
  zones: { source: 'as-zones', fill: 'as-zones-fill', line: 'as-zones-line', label: 'as-zones-label' },
  field: { source: 'as-field', fill: 'as-field-fill', line: 'as-field-line' },
  draw: { source: 'as-draw', fill: 'as-draw-fill', line: 'as-draw-line', points: 'as-draw-points' },
  vertices: { source: 'as-vertices', layer: 'as-vertices-layer' },
  ndvi: { source: 'as-ndvi', layer: 'as-ndvi-layer' },
  marker: { source: 'as-markers', layer: 'as-markers-layer' },
} as const;

/** Create every source and layer once the style is ready, in a stable z-order. */
export function installLayers(map: MapLibreMap): void {
  // Crop zones (lowest of the overlays).
  ensureSource(map, LAYERS.zones.source);
  ensureLayer(map, {
    id: LAYERS.zones.fill,
    type: 'fill',
    source: LAYERS.zones.source,
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.34 },
  });
  ensureLayer(map, {
    id: LAYERS.zones.line,
    type: 'line',
    source: LAYERS.zones.source,
    paint: { 'line-color': ['get', 'color'], 'line-width': 1.6, 'line-opacity': 0.9, 'line-dasharray': [2, 1.4] },
  });

  // NDVI raster overlay.
  ensureSource(map, LAYERS.ndvi.source);
  ensureLayer(map, {
    id: LAYERS.ndvi.layer,
    type: 'fill',
    source: LAYERS.ndvi.source,
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.72 },
  });

  // Analysed field boundary.
  ensureSource(map, LAYERS.field.source);
  ensureLayer(map, {
    id: LAYERS.field.fill,
    type: 'fill',
    source: LAYERS.field.source,
    paint: { 'fill-color': '#9edb02', 'fill-opacity': 0.1 },
  });
  ensureLayer(map, {
    id: LAYERS.field.line,
    type: 'line',
    source: LAYERS.field.source,
    paint: { 'line-color': '#9edb02', 'line-width': 2, 'line-opacity': 0.95 },
  });

  // In-progress drawing.
  ensureSource(map, LAYERS.draw.source);
  ensureLayer(map, {
    id: LAYERS.draw.fill,
    type: 'fill',
    source: LAYERS.draw.source,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': '#9edb02', 'fill-opacity': 0.22 },
  });
  ensureLayer(map, {
    id: LAYERS.draw.line,
    type: 'line',
    source: LAYERS.draw.source,
    filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'LineString']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#d7fa54', 'line-width': 2.4, 'line-opacity': 1 },
  });
  ensureLayer(map, {
    id: LAYERS.draw.points,
    type: 'circle',
    source: LAYERS.draw.source,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 5,
      'circle-color': '#01392b',
      'circle-stroke-color': '#d7fa54',
      'circle-stroke-width': 2.4,
    },
  });

  // Editable vertex handles for the active field.
  ensureSource(map, LAYERS.vertices.source);
  ensureLayer(map, {
    id: LAYERS.vertices.layer,
    type: 'circle',
    source: LAYERS.vertices.source,
    paint: {
      'circle-radius': ['case', ['==', ['get', 'active'], 1], 7, 5],
      'circle-color': ['case', ['==', ['get', 'active'], 1], '#d7fa54', '#f6f5ea'],
      'circle-stroke-color': '#01261b',
      'circle-stroke-width': 2,
      'circle-opacity': 1,
    },
  });

  // Markers sit above everything.
  ensureSource(map, LAYERS.marker.source);
  ensureLayer(map, {
    id: LAYERS.marker.layer,
    type: 'circle',
    source: LAYERS.marker.source,
    paint: {
      'circle-radius': ['get', 'radius'],
      'circle-color': ['get', 'color'],
      'circle-stroke-color': '#020d05',
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.95,
    },
  });
}

export function updateFieldLayer(map: MapLibreMap, coords: LngLat[] | null): void {
  if (!map.getSource(LAYERS.field.source)) return;
  const data = coords && coords.length >= 3 ? collection([toPolygonFeature(coords)]) : EMPTY;
  setData(map, LAYERS.field.source, data);
}

export interface DrawLayerInput {
  points: LngLat[];
  hover: LngLat | null;
  closed: boolean;
}

export function updateDrawLayer(map: MapLibreMap, input: DrawLayerInput): void {
  if (!map.getSource(LAYERS.draw.source)) return;
  const { points, hover, closed } = input;
  if (points.length === 0) {
    setData(map, LAYERS.draw.source, EMPTY);
    return;
  }

  const features: AnyFeature[] = [];

  const lineCoords = points.map((c) => [c.lng, c.lat] as [number, number]);
  if (hover && !closed) lineCoords.push([hover.lng, hover.lat]);
  if (closed) lineCoords.push([points[0].lng, points[0].lat]);

  if (lineCoords.length >= 2) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: lineCoords },
    });
  }

  if (points.length >= 3) {
    const ring = closeRing(points);
    features.push(toPolygonFeature(ring));
  }

  points.forEach((point) => features.push(toPointFeature(point)));

  setData(map, LAYERS.draw.source, collection(features));
}

export function updateZoneLayer(map: MapLibreMap, zones: CropZone[]): void {
  if (!map.getSource(LAYERS.zones.source)) return;
  const features: AnyFeature[] = zones
    .filter((zone) => zone.coords.length >= 3)
    .map((zone) => {
      const feature = toPolygonFeature(zone.coords);
      feature.properties = { color: zone.color, cropName: zone.cropName, id: zone.id };
      return feature as AnyFeature;
    });
  setData(map, LAYERS.zones.source, collection(features));
}

export function updateNdviLayer(map: MapLibreMap, overlay: NdviOverlayGeometry | null): void {
  if (!map.getSource(LAYERS.ndvi.source)) return;
  if (!overlay) {
    setData(map, LAYERS.ndvi.source, EMPTY);
    return;
  }
  const [minLng, minLat, maxLng, maxLat] = overlay.bbox;
  const cellWidth = (maxLng - minLng) / overlay.cols;
  const cellHeight = (maxLat - minLat) / overlay.rows;
  const features: AnyFeature[] = [];

  for (let row = 0; row < overlay.rows; row += 1) {
    for (let col = 0; col < overlay.cols; col += 1) {
      const color = overlay.colors[row * overlay.cols + col];
      if (!color) continue;
      // Grid rows run north to south in the raster read.
      const top = maxLat - row * cellHeight;
      const bottom = top - cellHeight;
      const left = minLng + col * cellWidth;
      const right = left + cellWidth;
      features.push({
        type: 'Feature',
        properties: { color },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [left, bottom],
              [right, bottom],
              [right, top],
              [left, top],
              [left, bottom],
            ],
          ],
        },
      });
    }
  }
  setData(map, LAYERS.ndvi.source, collection(features));
}

export interface MarkerSpec {
  coord: LngLat;
  color: string;
  radius: number;
}

export function updateMarkerLayer(map: MapLibreMap, markers: MarkerSpec[]): void {
  if (!map.getSource(LAYERS.marker.source)) return;
  const features: AnyFeature[] = markers.map((marker) => {
    const feature = toPointFeature(marker.coord);
    feature.properties = { color: marker.color, radius: marker.radius };
    return feature as AnyFeature;
  });
  setData(map, LAYERS.marker.source, collection(features));
}

export interface VertexEditSpec {
  index: number;
  coord: LngLat;
  active: boolean;
}

/** Render GIS-style square vertex handles for the field being edited. */
export function updateVertexLayer(map: MapLibreMap, vertices: VertexEditSpec[] | null): void {
  if (!map.getSource(LAYERS.vertices.source)) return;
  if (!vertices || !vertices.length) {
    setData(map, LAYERS.vertices.source, EMPTY);
    return;
  }
  const features: AnyFeature[] = vertices.map((vertex) => {
    const feature = toPointFeature(vertex.coord);
    feature.properties = { index: vertex.index, active: vertex.active ? 1 : 0 };
    return feature as AnyFeature;
  });
  setData(map, LAYERS.vertices.source, collection(features));
}

export function setDrawInteractivity(map: MapLibreMap, drawing: boolean): void {
  // While drawing, panning is disabled so a drag cannot move the camera away
  // from the field being traced.
  if (drawing) {
    map.dragPan.disable();
    map.boxZoom.disable();
    map.dragRotate.disable();
  } else {
    map.dragPan.enable();
    map.boxZoom.enable();
    map.dragRotate.enable();
  }
}

export { toLineFeature };
