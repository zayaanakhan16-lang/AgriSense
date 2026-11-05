import type { Field, LngLat, RegionType } from '@/types';
import { buildBoundary } from '@/store/fieldsStore';

/**
 * Region reference data — colour palette, crop / land-use options and the
 * demonstration region used to populate an empty workspace.
 *
 * Everything here is clearly labelled demonstration data. The area is computed
 * geodesically from the stored ring, so the card, the header and the map all
 * agree on the same number instead of quoting a hard-coded figure.
 */

export interface RegionColor {
  id: string;
  label: string;
  /** Hex used for the region fill and card icon. */
  hex: string;
}

/** Region fill palette. The first entry is the default selection. */
export const REGION_COLORS: RegionColor[] = [
  { id: 'gold', label: 'Harvest gold', hex: '#E3B341' },
  { id: 'olive', label: 'Olive', hex: '#9E8A2E' },
  { id: 'lime', label: 'AgriSense lime', hex: '#9EDB02' },
  { id: 'wheat', label: 'Wheat', hex: '#D9A441' },
  { id: 'clay', label: 'Clay', hex: '#C4703A' },
  { id: 'sage', label: 'Sage', hex: '#5F8525' },
  { id: 'sky', label: 'Reservoir blue', hex: '#5A9BD4' },
  { id: 'rose', label: 'Orchard rose', hex: '#C4708A' },
];

export const DEFAULT_REGION_COLOR = REGION_COLORS[0].hex;

export interface RegionTypeOption {
  id: RegionType;
  label: string;
  description: string;
}

export const REGION_TYPES: RegionTypeOption[] = [
  { id: 'rural', label: 'Rural / Land', description: 'Farm, forest, field' },
  { id: 'urban', label: 'Urban / City', description: 'City, town, suburb' },
];

/** Crop / land-use options offered in the New Region dialog. */
export const CROP_OPTIONS = [
  'Wheat',
  'Barley',
  'Flax',
  'Apple',
  'Maize',
  'Rice',
  'Cotton',
  'Soybean',
  'Potato',
  'Sugar beet',
  'Sunflower',
  'Grassland',
  'Forest',
  'Fallow',
  'Orchard',
] as const;

export const REGION_GROUP_OPTIONS = [
  'Ungrouped',
  'North block',
  'South block',
  'Home farm',
  'Rotation trial',
] as const;

export const DEFAULT_REGION_GROUP = 'Ungrouped';

/**
 * Colours for the crop-profile point grid rendered inside a field polygon.
 * The four categories match the reference legend: Wheat, Barley, Flax, Apple.
 */
export const CROP_PROFILE_COLORS: Record<string, string> = {
  Wheat: '#E3B341',
  Barley: '#9EDB02',
  Flax: '#5A9BD4',
  Apple: '#C4708A',
};

export const CROP_PROFILE_CATEGORIES = ['Wheat', 'Barley', 'Flax', 'Apple'] as const;
export type CropProfileCategory = (typeof CROP_PROFILE_CATEGORIES)[number];

/**
 * Demonstration region — a single irregular triangular field of ~203 acres
 * near Smolensk, Russia, matching the reference workspace.
 */
export const DEMO_REGION_COORDS: LngLat[] = [
  { lng: 32.043243, lat: 54.781081 },
  { lng: 32.060757, lat: 54.778162 },
  { lng: 32.052, lat: 54.792757 },
];

export const DEMO_REGION_ID = 'region-my-farm';

export function buildDemoRegion(): Field {
  return {
    id: DEMO_REGION_ID,
    name: 'My Farm',
    createdAt: '2026-10-28T09:24:00.000Z',
    status: 'ready',
    boundary: buildBoundary(DEMO_REGION_COORDS),
    locationLabel: '215280, Нapeзa, Smolensk, Russia',
    country: 'Russia',
    crop: 'Wheat',
    regionType: 'rural',
    group: DEFAULT_REGION_GROUP,
    color: DEFAULT_REGION_COLOR,
    isSample: true,
    notes: 'Demonstration region bundled with AgriSense.',
  };
}

export function regionColorHex(color: string | undefined): string {
  return color ?? DEFAULT_REGION_COLOR;
}
