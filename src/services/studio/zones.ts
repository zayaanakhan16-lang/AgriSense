import area from '@turf/area';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import centerOfMass from '@turf/center-of-mass';
import { featureCollection, polygon as turfPolygon } from '@turf/helpers';
import type { CropEvaluation, CropZone, Field, LngLat, SuitabilityVerdict } from '@/types';
import { centroidOf, closeRing, insetRing, polygonAreaM2 } from '@/lib/geo';
import type { PlanZoneSpec } from '@/store/planStore';

/** Re-exported so callers use one geometry surface for the studio. */
export const turfAreaM2 = (ring: LngLat[]): number => {
  if (ring.length < 3) return 0;
  return area(turfPolygon([closeRing(ring).map((c) => [c.lng, c.lat])]));
};

type Point2D = [number, number];
const M_PER_DEG_LAT = 110574;

function metresPerDegree(lat: number): { x: number; y: number } {
  return { x: (Math.PI / 180) * 6378137 * Math.cos((lat * Math.PI) / 180), y: M_PER_DEG_LAT };
}

function toLocal(ring: LngLat[], origin: LngLat): Point2D[] {
  const s = metresPerDegree(origin.lat);
  return ring.map((c) => [(c.lng - origin.lng) * s.x, (c.lat - origin.lat) * s.y]);
}

function toLngLat(ring: Point2D[], origin: LngLat): LngLat[] {
  const s = metresPerDegree(origin.lat);
  return ring.map(([x, y]) => ({ lng: origin.lng + x / s.x, lat: origin.lat + y / s.y }));
}

/** Sutherland–Hodgman clip against an axis-aligned half-plane. */
function clipHalfPlane(ring: Point2D[], axis: 0 | 1, value: number, keepGreater: boolean): Point2D[] {
  const inside = (p: Point2D): boolean => (keepGreater ? p[axis] >= value : p[axis] <= value);
  const out: Point2D[] = [];
  for (let i = 0; i < ring.length; i += 1) {
    const current = ring[i];
    const previous = ring[(i - 1 + ring.length) % ring.length];
    const ci = inside(current);
    const pi = inside(previous);
    if (ci !== pi) {
      const t = (value - previous[axis]) / (current[axis] - previous[axis] || 1);
      out.push([previous[0] + (current[0] - previous[0]) * t, previous[1] + (current[1] - previous[1]) * t]);
    }
    if (ci) out.push(current);
  }
  return out;
}

/**
 * Partition a ring into parallel strips whose areas follow `shares`.
 * Strips tile the ring exactly: the union is the original polygon and the
 * strips never overlap, so zone areas always sum to the field area.
 */
export function partitionRing(ring: LngLat[], shares: number[]): LngLat[][] {
  if (ring.length < 3 || !shares.length) return [];
  const origin = centroidOf(ring);
  const local = toLocal(ring, origin);
  const xs = local.map((p) => p[0]);
  const ys = local.map((p) => p[1]);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  const axis: 0 | 1 = spanX >= spanY ? 0 : 1;
  const min = axis === 0 ? Math.min(...xs) : Math.min(...ys);
  const max = axis === 0 ? Math.max(...xs) : Math.max(...ys);

  const total = shares.reduce((acc, s) => acc + Math.max(0, s), 0) || 1;
  const cumulative: number[] = [];
  let running = 0;
  for (const share of shares) {
    running += Math.max(0, share) / total;
    cumulative.push(running);
  }

  const rings: LngLat[][] = [];
  let lower = min;
  shares.forEach((_, index) => {
    const upper = index === shares.length - 1 ? max : min + (max - min) * cumulative[index];
    let clipped = clipHalfPlane(local, axis, lower, true);
    if (clipped.length >= 3) clipped = clipHalfPlane(clipped, axis, upper, false);
    rings.push(clipped.length >= 3 ? toLngLat(clipped, origin) : []);
    lower = upper;
  });
  return rings;
}

export interface StudioZone extends CropZone {
  /** 0..1 suitability score from the rules engine, when available. */
  score: number | null;
  scientificName: string | null;
  /** True when the zone geometry is a planning allocation, not measured evidence. */
  isProposed: boolean;
}

const FALLBACK_COLORS = ['#9edb02', '#d7fa54', '#6ed301', '#5f8525', '#264310', '#0b4a37'];

/** Colour assigned to a crop by its position in the approved ranking. */
export function zoneColor(index: number): string {
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export interface BuildStudioInput {
  field: Field;
  specs: PlanZoneSpec[];
  /** Approved/complete evaluation list, used to enrich zones with evidence. */
  evaluations: CropEvaluation[];
}

/**
 * Turn a scenario's crop specs into real polygons inside the farm boundary.
 * The ring is inset slightly so zones sit visually inside the drawn boundary.
 */
export function buildStudioZones(input: BuildStudioInput): StudioZone[] {
  const { field, specs, evaluations } = input;
  const ring = field.boundary.coords;
  if (ring.length < 3 || !specs.length) return [];

  const inset = insetRing(ring, Math.max(1.5, Math.sqrt(field.boundary.areaM2) * 0.012));
  const shareSum = specs.reduce((acc, s) => acc + Math.max(0, s.share), 0) || 1;
  const normalised = specs.map((s) => Math.max(0, s.share) / shareSum);
  const rings = partitionRing(inset, normalised);
  const byCrop = new Map(evaluations.map((e) => [e.crop.id, e]));

  return specs.map((spec, index) => {
    const coords = rings[index] ?? [];
    const evaluation = byCrop.get(spec.cropId) ?? null;
    const crop = evaluation?.crop ?? null;
    const areaM2 = coords.length >= 3 ? polygonAreaM2(coords) : field.boundary.areaM2 * normalised[index];
    const centroid = coords.length >= 3 ? centroidOf(coords) : field.boundary.centroid;
    const waterNeedMm = crop ? (crop.waterRequirementMm.min + crop.waterRequirementMm.max) / 2 : 0;
    return {
      id: spec.id,
      cropId: spec.cropId,
      cropName: crop?.name ?? 'Unknown crop',
      color: zoneColor(index),
      share: normalised[index],
      areaM2,
      waterNeedMm,
      rationale: evaluation?.rationale ?? 'Crop not present in the rules-engine evaluation for this field.',
      coords,
      centroid,
      verdict: (evaluation?.verdict ?? 'conditional') as SuitabilityVerdict,
      score: evaluation?.score ?? null,
      scientificName: crop?.scientificName ?? null,
      // No measured spatial differentiation is available, so zones are labelled
      // as proposed planning allocations rather than measured suitability.
      isProposed: true,
    };
  });
}

/** Verify every zone centroid actually falls inside the farm boundary. */
export function zonesContainedByField(zones: StudioZone[], field: Field): boolean {
  if (!zones.length) return true;
  const poly = turfPolygon([closeRing(field.boundary.coords).map((c) => [c.lng, c.lat])]);
  return zones.every((zone) => booleanPointInPolygon([zone.centroid.lng, zone.centroid.lat], poly));
}

export function zonesAreaM2(zones: StudioZone[]): number {
  return zones.reduce((acc, zone) => acc + zone.areaM2, 0);
}

/** Weighted mean water demand across the plan (mm of applied depth). */
export function weightedWaterMm(zones: StudioZone[]): number {
  return zones.reduce((acc, zone) => acc + zone.waterNeedMm * zone.share, 0);
}

export function meanSuitability(zones: StudioZone[]): number | null {
  const scored = zones.filter((zone) => zone.score !== null);
  if (!scored.length) return null;
  const totalShare = scored.reduce((acc, zone) => acc + zone.share, 0) || 1;
  return scored.reduce((acc, zone) => acc + (zone.score as number) * zone.share, 0) / totalShare;
}

export { centerOfMass, featureCollection, booleanPointInPolygon };
