import type { CropZone, Field, LngLat } from '@/types';
import { bboxSpanKm } from '@/lib/geo';

const TILE_SIZE = 256;

interface WorldPx {
  x: number;
  y: number;
}

function lngLatToWorldPx(lng: number, lat: number, zoom: number): WorldPx {
  const scale = TILE_SIZE * 2 ** zoom;
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

/** Zoom level that makes the field bbox span roughly `targetWidthPx` pixels. */
function zoomForBBox(bbox: [number, number, number, number], targetWidthPx: number): number {
  const span = bboxSpanKm(bbox);
  const widthKm = Math.max(span.widthKm, 0.02);
  const requiredMpp = (widthKm * 1000) / targetWidthPx;
  const zoom = Math.log2(156543.03392 / requiredMpp);
  return Math.max(3, Math.min(19, Math.floor(zoom)));
}

export interface SnapshotOptions {
  width?: number;
  /** Tile template with {z}/{x}/{y} placeholders. */
  tileTemplate?: string;
  zoom?: number;
}

export interface FieldSnapshot {
  dataUrl: string;
  width: number;
  height: number;
  zoom: number;
  project: (coord: LngLat) => { x: number; y: number };
}

const DEFAULT_TILE_TEMPLATE =
  'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Tile failed to load: ${url}`));
    image.src = url;
  });
}

/**
 * Compose a satellite snapshot of the field by fetching real raster tiles into a canvas.
 * Returns null when the tiles cannot be read — for example if a provider blocks canvas
 * export — so the caller can omit the map instead of embedding a broken image.
 */
export async function buildFieldSnapshot(
  bbox: [number, number, number, number],
  options: SnapshotOptions = {},
): Promise<FieldSnapshot | null> {
  const { width = 1200, tileTemplate = DEFAULT_TILE_TEMPLATE, zoom: forcedZoom } = options;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const zoom = forcedZoom ?? zoomForBBox(bbox, width);

  const northWest = lngLatToWorldPx(minLng, maxLat, zoom);
  const southEast = lngLatToWorldPx(maxLng, minLat, zoom);
  const spanX = Math.max(1, southEast.x - northWest.x);
  const spanY = Math.max(1, southEast.y - northWest.y);
  const scale = Math.min(width / spanX, 1400 / spanY);
  const height = Math.round(spanY * scale);
  const canvasWidth = Math.round(spanX * scale);

  const originX = northWest.x;
  const originY = northWest.y;

  const minTileX = Math.floor(northWest.x / TILE_SIZE);
  const maxTileX = Math.floor((northWest.x + spanX) / TILE_SIZE);
  const minTileY = Math.floor(northWest.y / TILE_SIZE);
  const maxTileY = Math.floor((northWest.y + spanY) / TILE_SIZE);
  const tileCount = (maxTileX - minTileX + 1) * (maxTileY - minTileY + 1);
  if (tileCount > 64) return null;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#020d05';
  context.fillRect(0, 0, canvasWidth, height);

  const n = 2 ** zoom;
  const jobs: Array<Promise<void>> = [];
  for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      if (tileY < 0 || tileY >= n) continue;
      const wrappedX = ((tileX % n) + n) % n;
      const url = tileTemplate
        .replace('{z}', String(zoom))
        .replace('{x}', String(wrappedX))
        .replace('{y}', String(tileY));
      const drawX = (tileX * TILE_SIZE - originX) * scale;
      const drawY = (tileY * TILE_SIZE - originY) * scale;
      jobs.push(
        loadImage(url)
          .then((image) => {
            context.drawImage(image, drawX, drawY, TILE_SIZE * scale, TILE_SIZE * scale);
          })
          .catch(() => {
            /* A single missing tile leaves the background colour rather than failing the snapshot. */
          }),
      );
    }
  }

  await Promise.all(jobs);

  const project = (coord: LngLat): { x: number; y: number } => {
    const world = lngLatToWorldPx(coord.lng, coord.lat, zoom);
    return { x: (world.x - originX) * scale, y: (world.y - originY) * scale };
  };

  try {
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.88), width: canvasWidth, height, zoom, project };
  } catch {
    return null;
  }
}

export interface SnapshotOverlayOptions {
  field: Field;
  zones?: CropZone[];
  showZones?: boolean;
}

/** Draw the field boundary and, optionally, the crop zones onto a composed snapshot. */
export async function drawSnapshotOverlay(
  snapshot: FieldSnapshot,
  options: SnapshotOverlayOptions,
): Promise<FieldSnapshot> {
  const { field, zones = [], showZones = true } = options;

  const base = await new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = snapshot.dataUrl;
  });
  if (!base) return snapshot;

  const canvas = document.createElement('canvas');
  canvas.width = snapshot.width;
  canvas.height = snapshot.height;
  const context = canvas.getContext('2d');
  if (!context) return snapshot;

  context.drawImage(base, 0, 0);

  const traceRing = (coords: LngLat[]): void => {
    coords.forEach((coord, index) => {
      const { x, y } = snapshot.project(coord);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
  };

  if (showZones && zones.length) {
    zones.forEach((zone) => {
      if (zone.coords.length < 3) return;
      context.beginPath();
      traceRing(zone.coords);
      context.fillStyle = `${zone.color}59`;
      context.fill();
      context.strokeStyle = zone.color;
      context.lineWidth = 1.5;
      context.stroke();
    });
  }

  context.beginPath();
  traceRing(field.boundary.coords);
  context.strokeStyle = '#9edb02';
  context.lineWidth = 3;
  context.stroke();

  const centroid = snapshot.project(field.boundary.centroid);
  context.beginPath();
  context.arc(centroid.x, centroid.y, 5, 0, Math.PI * 2);
  context.fillStyle = '#9edb02';
  context.fill();
  context.strokeStyle = '#01392b';
  context.lineWidth = 2;
  context.stroke();

  try {
    return { ...snapshot, dataUrl: canvas.toDataURL('image/jpeg', 0.9) };
  } catch {
    return snapshot;
  }
}
