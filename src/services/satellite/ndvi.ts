import { fromUrl, type GeoTIFFImage } from 'geotiff';
import proj4 from 'proj4';
import type { BBox } from '@/lib/geo';
import type { LngLat, NdviGrid, NdviStats, SatelliteItem, VegetationResult } from '@/types';
import { closeRing, haversineM, padBBox, pointInPolygon } from '@/lib/geo';
import { fetchJson } from '@/services/http';
import { sourceWithRetrieval } from '@/services/sources';
import { ndviRamp } from './colorRamp';

const STAC_ENDPOINT = 'https://earth-search.aws.element84.com/v1/search';
const COLLECTION = 'sentinel-2-l2a';
/** Grid resolution used for both the raster read and the map overlay. */
const TARGET_SAMPLES = 96;

interface StacAsset {
  href: string;
  type?: string;
}
interface StacFeature {
  id: string;
  collection: string;
  bbox: [number, number, number, number];
  properties: Record<string, unknown>;
  assets: Record<string, StacAsset>;
}
interface StacResponse {
  features: StacFeature[];
}

export interface SatelliteSearchOptions {
  maxCloudCover?: number;
  lookbackDays?: number;
  signal?: AbortSignal;
}

export function tileIdFromItemId(itemId: string): string {
  const parts = itemId.split('_');
  if (parts.length < 3) return itemId;
  const grid = parts[1];
  if (grid.length < 5) return grid;
  return `${grid.slice(0, 2)}/${grid.slice(2, 3)}/${grid.slice(3, 5)}`;
}

function parseStacItem(feature: StacFeature): SatelliteItem {
  const props = feature.properties as {
    datetime?: string;
    platform?: string;
    'eo:cloud_cover'?: number;
  };
  return {
    id: feature.id,
    collection: feature.collection,
    platform: props.platform ?? 'Sentinel-2',
    datetime: props.datetime ?? new Date().toISOString(),
    cloudCover: props['eo:cloud_cover'] ?? 0,
    bbox: feature.bbox,
    assets: {
      red: feature.assets.red?.href,
      nir: feature.assets.nir?.href,
      visual: feature.assets.visual?.href,
      thumbnail: feature.assets.thumbnail?.href,
    },
    tileId: tileIdFromItemId(feature.id),
  };
}

/** Locate the most recent low-cloud Sentinel-2 L2A acquisitions intersecting the field. */
export async function searchSentinelItems(
  bbox: BBox,
  options: SatelliteSearchOptions = {},
): Promise<SatelliteItem[]> {
  const { maxCloudCover = 60, lookbackDays = 120, signal } = options;
  const body: Record<string, unknown> = {
    collections: [COLLECTION],
    bbox,
    limit: 24,
    sortby: [{ field: 'properties.datetime', direction: 'desc' }],
    query: { 'eo:cloud_cover': { lt: maxCloudCover } },
  };
  if (lookbackDays > 0) {
    const from = new Date(Date.now() - lookbackDays * 86400000).toISOString();
    body.datetime = `${from}/${new Date().toISOString()}`;
  }

  const response = await fetchJson<StacResponse>(STAC_ENDPOINT, {
    method: 'POST',
    body,
    timeoutMs: 25000,
    signal,
  });
  return (response.features ?? []).map(parseStacItem);
}

interface RasterReadResult {
  values: Float32Array;
  width: number;
  height: number;
  originX: number;
  originY: number;
  resolutionX: number;
  resolutionY: number;
  epsg: number;
}

interface Window {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  epsg: number;
}

function projectedWindow(bbox: BBox, epsg: number): Window {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const corners: Array<[number, number]> = [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
  ];
  const projected = corners.map(([lng, lat]) => {
    if (epsg === 4326) return [lng, lat] as [number, number];
    const [x, y] = proj4('EPSG:4326', `EPSG:${epsg}`, [lng, lat]);
    return [x, y] as [number, number];
  });
  const xs = projected.map((p) => p[0]);
  const ys = projected.map((p) => p[1]);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
    epsg,
  };
}

function resolveEpsg(image: GeoTIFFImage): number {
  const keys = image.getGeoKeys();
  const raw = (keys?.ProjectedCSTypeGeoKey ?? keys?.GeographicTypeGeoKey) as number | undefined;
  if (raw && raw !== 32767 && raw !== 32766) return raw;
  return 32643;
}

async function readRasterWindow(image: GeoTIFFImage, bbox: BBox): Promise<RasterReadResult> {
  const epsg = resolveEpsg(image);
  const window = projectedWindow(bbox, epsg);
  const [originX, originY] = image.getOrigin() as [number, number];
  const [resX, resY] = image.getResolution() as [number, number];
  const imageWidth = image.getWidth();
  const imageHeight = image.getHeight();

  let minCol = Math.floor((window.minX - originX) / resX);
  let maxCol = Math.ceil((window.maxX - originX) / resX);
  let minRow = Math.floor((window.maxY - originY) / resY);
  let maxRow = Math.ceil((window.minY - originY) / resY);

  minCol = Math.max(0, Math.min(imageWidth - 1, minCol));
  maxCol = Math.max(1, Math.min(imageWidth, maxCol));
  minRow = Math.max(0, Math.min(imageHeight - 1, minRow));
  maxRow = Math.max(1, Math.min(imageHeight, maxRow));

  if (maxCol <= minCol || maxRow <= minRow) {
    throw new Error('The field footprint falls outside the satellite tile coverage.');
  }

  const aspect = (maxCol - minCol) / Math.max(1, maxRow - minRow);
  const width = Math.max(12, Math.min(TARGET_SAMPLES, Math.round(TARGET_SAMPLES * Math.min(1, aspect))));
  const height = Math.max(12, Math.min(TARGET_SAMPLES, Math.round(width / Math.max(aspect, 0.0001))));

  const rasters = (await image.readRasters({
    window: [minCol, minRow, maxCol, maxRow],
    width,
    height,
    interleave: false,
  })) as unknown as ArrayLike<ArrayLike<number>>;

  const band = rasters[0];
  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i += 1) values[i] = Number(band[i] ?? 0);

  return {
    values,
    width,
    height,
    originX: originX + minCol * resX,
    originY: originY + minRow * resY,
    resolutionX: (resX * (maxCol - minCol)) / width,
    resolutionY: (resY * (maxRow - minRow)) / height,
    epsg,
  };
}

function pixelToLngLat(read: RasterReadResult, col: number, row: number): LngLat {
  const x = read.originX + (col + 0.5) * read.resolutionX;
  const y = read.originY + (row + 0.5) * read.resolutionY;
  if (read.epsg === 4326) return { lng: x, lat: y };
  const [lng, lat] = proj4(`EPSG:${read.epsg}`, 'EPSG:4326', [x, y]);
  return { lng, lat };
}

function statsFrom(values: number[]): NdviStats {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / sorted.length;
  const quantile = (q: number): number => {
    if (!sorted.length) return 0;
    const idx = (sorted.length - 1) * q;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const count = (min: number, max: number): number =>
    sorted.filter((v) => v >= min && v < max).length / sorted.length;

  return {
    mean,
    median: quantile(0.5),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p10: quantile(0.1),
    p90: quantile(0.9),
    bands: {
      healthy: count(0.65, Infinity),
      good: count(0.5, 0.65),
      moderate: count(0.35, 0.5),
      poor: count(0.2, 0.35),
      stressed: count(-Infinity, 0.2),
      nodata: 0,
    },
    validPixels: sorted.length,
    totalPixels: sorted.length,
  };
}

export interface NdviComputeOptions {
  signal?: AbortSignal;
  /** Boundary used to mask the raster to the drawn field. */
  boundary?: LngLat[];
  /** Also compute a previous-scene mean for a change indicator. */
  withChange?: boolean;
}

/**
 * Compute NDVI for a field from real Sentinel-2 L2A red (B04) and near-infrared (B08)
 * surface-reflectance COG bands. Both bands are read client-side over HTTP range
 * requests; NDVI = (NIR − Red) / (NIR + Red).
 */
export async function computeNdvi(
  item: SatelliteItem,
  bbox: BBox,
  options: NdviComputeOptions = {},
): Promise<VegetationResult> {
  const { signal, boundary, withChange = false } = options;
  if (!item.assets.red || !item.assets.nir) {
    throw new Error('This catalogue item does not expose the red and NIR bands required for NDVI.');
  }

  const padded = padBBox(bbox, 0.05);
  const [redImage, nirImage] = await Promise.all([
    fromUrl(item.assets.red, {}, signal).then((t) => t.getImage()),
    fromUrl(item.assets.nir, {}, signal).then((t) => t.getImage()),
  ]);

  const [redRead, nirRead] = await Promise.all([
    readRasterWindow(redImage, padded),
    readRasterWindow(nirImage, padded),
  ]);

  const width = Math.min(redRead.width, nirRead.width);
  const height = Math.min(redRead.height, nirRead.height);
  const ring = boundary && boundary.length >= 3 ? closeRing(boundary) : null;

  const gridValues: Array<number | null> = new Array(width * height).fill(null);
  const validSamples: number[] = [];
  const overlayRowMajor: Array<string | null> = new Array(width * height).fill(null);

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const idx = row * width + col;
      const coord = pixelToLngLat(redRead, col, row);
      const inside = ring ? pointInPolygon(coord, ring) : true;
      const red = redRead.values[idx];
      const nir = nirRead.values[idx];
      if (!inside || !Number.isFinite(red) || !Number.isFinite(nir) || red === 0 || nir === 0) {
        continue;
      }
      const denominator = nir + red;
      if (denominator === 0) continue;
      const ndvi = (nir - red) / denominator;
      if (ndvi < -1 || ndvi > 1) continue;
      gridValues[idx] = ndvi;
      overlayRowMajor[idx] = `rgb(${ndviRamp(ndvi).join(',')})`;
      validSamples.push(ndvi);
    }
  }

  if (validSamples.length < 6) {
    throw new Error(
      'Not enough valid satellite pixels intersect this boundary — the field may be too small for a 10 m Sentinel-2 pixel grid.',
    );
  }

  const stats = statsFrom(validSamples);
  const grid: NdviGrid = { width, height, values: gridValues };

  let change: VegetationResult['change'] = null;
  if (withChange) {
    change = await computeNdviChange(item, bbox, stats.mean, boundary, signal).catch(() => null);
  }

  return {
    stats,
    grid,
    overlay: {
      type: 'polygon-grid',
      bbox: padded,
      cols: width,
      rows: height,
      colors: overlayRowMajor,
    },
    item,
    change,
  };
}

async function computeNdviChange(
  current: SatelliteItem,
  bbox: BBox,
  currentMean: number,
  boundary: LngLat[] | undefined,
  signal?: AbortSignal,
): Promise<VegetationResult['change']> {
  const history = await searchSentinelItems(bbox, { maxCloudCover: 35, lookbackDays: 120, signal });
  const previous = history.find(
    (candidate) =>
      candidate.id !== current.id &&
      new Date(current.datetime).getTime() - new Date(candidate.datetime).getTime() > 12 * 86400000,
  );
  if (!previous?.assets.red || !previous.assets.nir) return null;

  const padded = padBBox(bbox, 0.05);
  const [redImage, nirImage] = await Promise.all([
    fromUrl(previous.assets.red, {}, signal).then((t) => t.getImage()),
    fromUrl(previous.assets.nir, {}, signal).then((t) => t.getImage()),
  ]);
  const [redRead, nirRead] = await Promise.all([
    readRasterWindow(redImage, padded),
    readRasterWindow(nirImage, padded),
  ]);
  const width = Math.min(redRead.width, nirRead.width);
  const height = Math.min(redRead.height, nirRead.height);
  const ring = boundary && boundary.length >= 3 ? closeRing(boundary) : null;
  const samples: number[] = [];
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const idx = row * width + col;
      const coord = pixelToLngLat(redRead, col, row);
      if (ring && !pointInPolygon(coord, ring)) continue;
      const red = redRead.values[idx];
      const nir = nirRead.values[idx];
      if (!Number.isFinite(red) || !Number.isFinite(nir) || red === 0 || nir === 0) continue;
      const ndvi = (nir - red) / (nir + red);
      if (ndvi >= -1 && ndvi <= 1) samples.push(ndvi);
    }
  }
  if (samples.length < 6) return null;
  const previousMean = samples.reduce((acc, v) => acc + v, 0) / samples.length;
  return { delta: currentMean - previousMean, previousDate: previous.datetime, previousMean };
}

export const NDVI_SOURCES = {
  catalog: sourceWithRetrieval('sentinelCatalog'),
  cogs: sourceWithRetrieval('sentinelCogs'),
};


/** Approximate ground sample distance implied by the raster read, for honest labelling. */
export function effectiveGroundSampleM(result: VegetationResult, bbox: BBox): number {
  const spanM = haversineM({ lng: bbox[0], lat: (bbox[1] + bbox[3]) / 2 }, { lng: bbox[2], lat: (bbox[1] + bbox[3]) / 2 });
  return spanM / Math.max(1, result.grid.width);
}
