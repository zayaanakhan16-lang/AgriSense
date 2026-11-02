/** NDVI colour ramp — the legend, the raster overlay and the charts share this scale. */
export interface NdviBand {
  id: 'stressed' | 'poor' | 'moderate' | 'good' | 'healthy' | 'nodata';
  label: string;
  range: [number, number];
  color: string;
  description: string;
}

export const NDVI_BANDS: NdviBand[] = [
  {
    id: 'healthy',
    label: 'Healthy vegetation',
    range: [0.65, 1],
    color: '#1F7A4D',
    description: 'Dense, vigorous canopy with high chlorophyll and biomass.',
  },
  {
    id: 'good',
    label: 'Good vegetation',
    range: [0.5, 0.65],
    color: '#4FA84A',
    description: 'Actively growing canopy, typical of a well-performing crop.',
  },
  {
    id: 'moderate',
    label: 'Moderate vegetation',
    range: [0.35, 0.5],
    color: '#C9D63F',
    description: 'Developing or thinning canopy. Monitor for stress onset.',
  },
  {
    id: 'poor',
    label: 'Sparse / stressed',
    range: [0.2, 0.35],
    color: '#E39A34',
    description: 'Low canopy cover, likely water, nutrient or pest stress.',
  },
  {
    id: 'stressed',
    label: 'Bare or severely stressed',
    range: [-1, 0.2],
    color: '#C8483C',
    description: 'Bare soil, senescent or failed vegetation.',
  },
  {
    id: 'nodata',
    label: 'No data',
    range: [-1, -1],
    color: '#8C9793',
    description: 'Outside the field boundary, cloud, shadow or masked pixel.',
  },
];

export const NDVI_NODATA_COLOR = '#8C9793';

export function ndviBandFor(value: number): NdviBand {
  if (value >= 0.65) return NDVI_BANDS[0];
  if (value >= 0.5) return NDVI_BANDS[1];
  if (value >= 0.35) return NDVI_BANDS[2];
  if (value >= 0.2) return NDVI_BANDS[3];
  return NDVI_BANDS[4];
}

export function ndviColor(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) return null;
  return ndviBandFor(value).color;
}

/** Continuous ramp for raster rendering — smooth interpolation between band anchors. */
const ANCHORS: Array<[number, [number, number, number]]> = [
  [-0.2, [136, 66, 52]],
  [0.1, [200, 72, 60]],
  [0.2, [227, 154, 52]],
  [0.35, [201, 214, 63]],
  [0.5, [79, 168, 74]],
  [0.65, [31, 122, 77]],
  [0.9, [16, 92, 62]],
];

export function ndviRamp(value: number): [number, number, number] {
  const v = Math.max(-0.2, Math.min(0.9, value));
  for (let i = 0; i < ANCHORS.length - 1; i += 1) {
    const [v0, c0] = ANCHORS[i];
    const [v1, c1] = ANCHORS[i + 1];
    if (v >= v0 && v <= v1) {
      const t = (v - v0) / (v1 - v0 || 1);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * t),
        Math.round(c0[1] + (c1[1] - c0[1]) * t),
        Math.round(c0[2] + (c1[2] - c0[2]) * t),
      ];
    }
  }
  return ANCHORS[ANCHORS.length - 1][1];
}

export function ndviLabel(value: number | null): string {
  if (value === null) return 'No data';
  return ndviBandFor(value).label;
}
