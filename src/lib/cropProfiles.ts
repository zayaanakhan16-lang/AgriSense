import type { LngLat } from '@/types';
import { bboxOf, pointInPolygon } from '@/lib/geo';
import { CROP_PROFILE_CATEGORIES, CROP_PROFILE_COLORS } from '@/data/regions';

export interface CropProfilePoint {
  coord: LngLat;
  category: (typeof CROP_PROFILE_CATEGORIES)[number];
  color: string;
}

/**
 * Build a grid of crop-profile sample points inside a polygon.
 *
 * The grid is generated in the polygon's bounding box and then clipped with a
 * point-in-polygon test, so points never appear outside the field boundary.
 * The category assigned to each point is deterministic for a given ring, so the
 * legend and filters stay stable across renders.
 */
export function buildCropProfilePoints(ring: LngLat[], targetCount = 220): CropProfilePoint[] {
  if (ring.length < 3) return [];
  const [minLng, minLat, maxLng, maxLat] = bboxOf(ring);
  const spanLng = maxLng - minLng;
  const spanLat = maxLat - minLat;
  if (spanLng <= 0 || spanLat <= 0) return [];

  // Choose a near-square grid resolution so the point density is even.
  const aspect = spanLng / spanLat;
  const cols = Math.max(6, Math.round(Math.sqrt(targetCount * aspect)));
  const rows = Math.max(6, Math.round(targetCount / cols));

  const points: CropProfilePoint[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const lng = minLng + ((col + 0.5) / cols) * spanLng;
      const lat = minLat + ((row + 0.5) / rows) * spanLat;
      const coord: LngLat = { lng, lat };
      if (!pointInPolygon(coord, ring)) continue;
      // Deterministic category from a spatial hash so neighbours vary.
      const hash = (row * 73856093) ^ (col * 19349663);
      const index = Math.abs(hash) % CROP_PROFILE_CATEGORIES.length;
      const category = CROP_PROFILE_CATEGORIES[index];
      points.push({ coord, category, color: CROP_PROFILE_COLORS[category] });
    }
  }
  return points;
}
