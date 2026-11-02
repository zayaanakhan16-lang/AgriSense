import type { LngLat } from '@/types';

const EARTH_RADIUS_M = 6378137;
const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/**
 * Geodesic polygon area (m²) using the spherical excess method
 * (Chamberlain & Duquette). Accurate to <0.1% for field-scale polygons.
 */
export function polygonAreaM2(ring: LngLat[]): number {
  if (ring.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % ring.length];
    total += toRad(p2.lng - p1.lng) * (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

export function haversineM(a: LngLat, b: LngLat): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function perimeterM(ring: LngLat[]): number {
  if (ring.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < ring.length; i += 1) {
    total += haversineM(ring[i], ring[(i + 1) % ring.length]);
  }
  return total;
}

export type BBox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

export function bboxOf(coords: LngLat[]): BBox {
  if (!coords.length) return [0, 0, 0, 0];
  let minLng = coords[0].lng;
  let minLat = coords[0].lat;
  let maxLng = coords[0].lng;
  let maxLat = coords[0].lat;
  for (const c of coords) {
    minLng = Math.min(minLng, c.lng);
    minLat = Math.min(minLat, c.lat);
    maxLng = Math.max(maxLng, c.lng);
    maxLat = Math.max(maxLat, c.lat);
  }
  return [minLng, minLat, maxLng, maxLat];
}

export function padBBox(bbox: BBox, ratio = 0.25): BBox {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const dLng = Math.max((maxLng - minLng) * ratio, 0.0006);
  const dLat = Math.max((maxLat - minLat) * ratio, 0.0006);
  return [minLng - dLng, minLat - dLat, maxLng + dLng, maxLat + dLat];
}

export function bboxCenter(bbox: BBox): LngLat {
  return { lng: (bbox[0] + bbox[2]) / 2, lat: (bbox[1] + bbox[3]) / 2 };
}

export function bboxSpanKm(bbox: BBox): { widthKm: number; heightKm: number } {
  const center = bboxCenter(bbox);
  return {
    widthKm: haversineM({ lng: bbox[0], lat: center.lat }, { lng: bbox[2], lat: center.lat }) / 1000,
    heightKm: haversineM({ lng: center.lng, lat: bbox[1] }, { lng: center.lng, lat: bbox[3] }) / 1000,
  };
}

export function centroidOf(coords: LngLat[]): LngLat {
  if (!coords.length) return { lng: 0, lat: 0 };
  const sum = coords.reduce((acc, c) => ({ lng: acc.lng + c.lng, lat: acc.lat + c.lat }), {
    lng: 0,
    lat: 0,
  });
  return { lng: sum.lng / coords.length, lat: sum.lat / coords.length };
}

export function closeRing(coords: LngLat[]): LngLat[] {
  if (coords.length < 3) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first.lng === last.lng && first.lat === last.lat) return coords;
  return [...coords, first];
}

export function toPolygonFeature(coords: LngLat[]): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring = closeRing(coords);
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring.map((c) => [c.lng, c.lat])] },
  };
}

export function toLineFeature(coords: LngLat[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords.map((c) => [c.lng, c.lat]) },
  };
}

export function toPointFeature(coord: LngLat): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [coord.lng, coord.lat] },
  };
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(point: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i].lng;
    const yi = ring[i].lat;
    const xj = ring[j].lng;
    const yj = ring[j].lat;
    const intersect = yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Move a point by metres along a bearing (great-circle direct problem). */
export function destination(from: LngLat, distanceM: number, bearingDeg: number): LngLat {
  const angular = distanceM / EARTH_RADIUS_M;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(from.lat);
  const lng1 = toRad(from.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lng: toDeg(lng2), lat: toDeg(lat2) };
}

/** Inward-buffered ring used for crop-zone allocation inside a drawn boundary. */
export function insetRing(ring: LngLat[], metres: number): LngLat[] {
  const centroid = centroidOf(ring);
  return ring.map((c) => {
    const distance = haversineM(centroid, c);
    if (distance <= metres) return c;
    const bearing = bearingDeg(centroid, c);
    return destination(centroid, distance - metres, bearing);
  });
}

export function bearingDeg(from: LngLat, to: LngLat): number {
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Web-Mercator tile coordinate for a lng/lat at a zoom level. */
export function lngLatToTile(lng: number, lat: number, zoom: number): { x: number; y: number; z: number } {
  const z = Math.floor(zoom);
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = toRad(lat);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x: ((x % n) + n) % n, y: Math.min(Math.max(y, 0), n - 1), z };
}

export function lngLatZoomForBBox(bbox: BBox, widthPx: number, heightPx: number): { center: LngLat; zoom: number } {
  const center = bboxCenter(bbox);
  const span = bboxSpanKm(bbox);
  const maxSpanKm = Math.max(span.widthKm, span.heightKm, 0.05);
  const worldPx = 512;
  const zoom = Math.log2((360 * worldPx * Math.min(widthPx, heightPx) * 0.85) / (maxSpanKm * 111.32 * 360)) ;
  return { center, zoom: Math.min(Math.max(zoom, 1), 20) };
}
