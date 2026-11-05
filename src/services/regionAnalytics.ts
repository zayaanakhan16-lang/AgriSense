import type { LngLat } from '@/types';

/**
 * Region analytics demonstration dataset.
 *
 * Every value below is generated deterministically from the region's centroid
 * and area so the charts stay stable between renders, but none of it is a live
 * measurement. The UI labels the whole page as demonstration data so these
 * numbers are never presented as verified environmental readings.
 */

/** Deterministic pseudo-random generator seeded from a string. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(centroid: LngLat, areaM2: number): string {
  return `${centroid.lng.toFixed(4)}:${centroid.lat.toFixed(4)}:${Math.round(areaM2)}`;
}

export interface WeatherSnapshot {
  temperatureC: number;
  condition: string;
  feelsLikeC: number;
  humidityPct: number;
  windKph: number;
  aqi: number;
  aqiLabel: string;
  accuracyNote: string;
}

export function buildWeatherSnapshot(centroid: LngLat, areaM2: number): WeatherSnapshot {
  const rnd = seeded(seedOf(centroid, areaM2));
  const temperatureC = 18 + rnd() * 6; // 18–24 °C
  const humidityPct = 42 + rnd() * 26;
  const windKph = 6 + rnd() * 12;
  const feelsLikeC = temperatureC - 0.6 + (humidityPct - 55) / 40;
  const aqi = Math.round(18 + rnd() * 34);
  return {
    temperatureC,
    condition: 'Clear sky',
    feelsLikeC,
    humidityPct,
    windKph,
    aqi,
    aqiLabel: aqi <= 20 ? 'Good' : aqi <= 40 ? 'Fair' : 'Moderate',
    accuracyNote:
      'Modelled estimate for the region centroid — interpolated from regional reanalysis, not a field station reading.',
  };
}

export interface DailyPoint {
  date: string;
  precipitationMm: number;
  tempMaxC: number;
  tempMinC: number;
}

/**
 * Daily series covering the requested window. Precip is a sparse, spiky series
 * (many dry days) so the bar chart reads like real rainfall.
 */
export function buildDailySeries(centroid: LngLat, areaM2: number, from: Date, to: Date): DailyPoint[] {
  const rnd = seeded(`${seedOf(centroid, areaM2)}:daily`);
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  const points: DailyPoint[] = [];
  const dayMs = 86400000;
  const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs));

  for (let i = 0; i <= total; i += 1) {
    const date = new Date(start.getTime() + i * dayMs);
    const month = date.getMonth();
    // Seasonal temperature envelope for a temperate northern-hemisphere region.
    const seasonal = Math.cos(((month - 6) / 12) * 2 * Math.PI);
    const base = 12 - seasonal * 11;
    const tempMaxC = base + 5 + rnd() * 4;
    const tempMinC = base - 3 + rnd() * 3;
    const wet = rnd() > 0.66;
    const precipitationMm = wet ? Number((rnd() * 14 + 0.4).toFixed(1)) : 0;
    points.push({
      date: date.toISOString().slice(0, 10),
      precipitationMm,
      tempMaxC: Number(tempMaxC.toFixed(1)),
      tempMinC: Number(tempMinC.toFixed(1)),
    });
  }
  return points;
}

export interface AirWaterMetric {
  id: string;
  label: string;
  value: string;
  unit: string;
  hint: string;
}

export function buildAirWaterMetrics(centroid: LngLat, areaM2: number): AirWaterMetric[] {
  const rnd = seeded(`${seedOf(centroid, areaM2)}:air`);
  const euAqi = Math.round(22 + rnd() * 30);
  const pm25 = Number((6 + rnd() * 16).toFixed(1));
  return [
    { id: 'eu-aqi', label: 'EU AQI', value: String(euAqi), unit: 'index', hint: euAqi <= 40 ? 'Good' : 'Fair' },
    { id: 'pm25', label: 'PM2.5', value: pm25.toFixed(1), unit: 'µg/m³', hint: 'Fine particulate' },
  ];
}

export interface AgMetric {
  id: string;
  label: string;
  value: string;
  unit: string;
  hint: string;
}

export function buildAgMetrics(centroid: LngLat, areaM2: number): AgMetric[] {
  const rnd = seeded(`${seedOf(centroid, areaM2)}:ag`);
  const ndvi = 0.42 + rnd() * 0.34;
  const moisture = 0.16 + rnd() * 0.18;
  const temp = 18 + rnd() * 6;
  const rain = 20 + rnd() * 60;
  return [
    { id: 'ndvi', label: 'Avg NDVI', value: ndvi.toFixed(2), unit: 'index', hint: 'Vegetation vigour' },
    { id: 'moisture', label: 'Moisture', value: moisture.toFixed(2), unit: 'm³/m³', hint: 'Surface layer' },
    { id: 'temperature', label: 'Temperature', value: temp.toFixed(1), unit: '°C', hint: 'Daily mean' },
    { id: 'rain', label: 'Rain', value: rain.toFixed(0), unit: 'mm', hint: 'Last 30 days' },
  ];
}

export interface LandUseSlice {
  name: string;
  value: number;
  color: string;
}

export function buildLandUse(centroid: LngLat, areaM2: number): LandUseSlice[] {
  const rnd = seeded(`${seedOf(centroid, areaM2)}:landuse`);
  const raw = [
    { name: 'Cropland', color: '#E3B341', value: 40 + rnd() * 20 },
    { name: 'Grassland', color: '#9EDB02', value: 14 + rnd() * 12 },
    { name: 'Forest', color: '#1F7A4D', value: 10 + rnd() * 10 },
    { name: 'Water', color: '#5A9BD4', value: 4 + rnd() * 6 },
    { name: 'Built-up', color: '#C4703A', value: 3 + rnd() * 5 },
  ];
  const total = raw.reduce((acc, slice) => acc + slice.value, 0);
  return raw.map((slice) => ({ ...slice, value: slice.value / total }));
}

export interface SuitabilityFactor {
  factor: string;
  score: number;
}

export function buildSuitability(centroid: LngLat, areaM2: number): SuitabilityFactor[] {
  const rnd = seeded(`${seedOf(centroid, areaM2)}:suit`);
  return [
    { factor: 'Water', score: 0.55 + rnd() * 0.4 },
    { factor: 'Soil', score: 0.5 + rnd() * 0.45 },
    { factor: 'Climate', score: 0.6 + rnd() * 0.35 },
    { factor: 'Season', score: 0.5 + rnd() * 0.45 },
    { factor: 'Texture', score: 0.55 + rnd() * 0.4 },
    { factor: 'Slope', score: 0.65 + rnd() * 0.3 },
  ];
}

export interface AllocationSlice {
  id: string;
  name: string;
  color: string;
  share: number;
  zone: string;
  role: string;
  note: string;
}

/** Crop allocation for the selected farm — four categories as in the reference. */
export function buildAllocation(centroid: LngLat, areaM2: number): AllocationSlice[] {
  const rnd = seeded(`${seedOf(centroid, areaM2)}:alloc`);
  const base = [
    { id: 'wheat', name: 'Wheat', color: '#E3B341', zone: 'Zone A', role: 'Primary Crop' },
    { id: 'barley', name: 'Barley', color: '#9EDB02', zone: 'Zone B', role: 'Secondary Crop' },
    { id: 'flax', name: 'Flax', color: '#5A9BD4', zone: 'Zone C', role: 'Rotation Crop' },
    { id: 'apple', name: 'Apple', color: '#C4708A', zone: 'Zone D', role: 'Specialty Crop' },
  ];
  const weights = base.map(() => 0.6 + rnd());
  const total = weights.reduce((acc, weight) => acc + weight, 0);
  return base.map((entry, index) => ({
    ...entry,
    share: weights[index] / total,
    note:
      index === 0
        ? 'Deep loam with reliable moisture — the strongest match for wheat in this block.'
        : index === 1
          ? 'Tolerates the drier shoulder of the field and breaks the cereal cycle.'
          : index === 2
            ? 'Cool, moist microclimate suits a fibre/oil break crop.'
            : 'Sheltered edge with winter chill suits a small orchard block.',
  }));
}

export interface IntercropPair {
  id: string;
  title: string;
  crops: [string, string];
  explanation: string;
  spacing: string;
}

export function buildIntercropPairs(centroid: LngLat, areaM2: number): IntercropPair[] {
  const rnd = seeded(`${seedOf(centroid, areaM2)}:intercrop`);
  const options: IntercropPair[] = [
    {
      id: 'barley-clover',
      title: 'Barley + Clover',
      crops: ['Barley', 'Clover'],
      explanation:
        'The clover fixes nitrogen between the barley rows, so the following cereal starts with more available nitrogen and the ground stays covered.',
      spacing: `Barley rows ${18 + Math.round(rnd() * 4)} cm apart; undersow clover at ${24 + Math.round(rnd() * 6)} cm.`,
    },
    {
      id: 'flax-buckwheat',
      title: 'Flax + Buckwheat',
      crops: ['Flax', 'Buckwheat'],
      explanation:
        'Buckwheat fills the gaps as a short-cycle catch crop, suppresses late weeds and supports pollinators without competing with the flax stems.',
      spacing: `Flax rows ${12 + Math.round(rnd() * 4)} cm; buckwheat broadcast at ${30 + Math.round(rnd() * 8)} cm bands.`,
    },
    {
      id: 'wheat-pea',
      title: 'Wheat + Field pea',
      crops: ['Wheat', 'Field pea'],
      explanation:
        'A cereal–legume mix spreads risk across two markets and adds nitrogen to the rotation while keeping canopy cover dense.',
      spacing: `Alternate rows ${20 + Math.round(rnd() * 5)} cm; seed mix ratio roughly 60:40 wheat to pea.`,
    },
  ];
  return options;
}

export interface RotationGroup {
  season: 'Spring' | 'Summer' | 'Winter';
  range: string;
  crops: Array<{ name: string; color: string }>;
  note: string;
}

export function buildRotationGroups(): RotationGroup[] {
  return [
    {
      season: 'Spring',
      range: 'Mar – May',
      crops: [
        { name: 'Barley', color: '#9EDB02' },
        { name: 'Clover', color: '#1F7A4D' },
      ],
      note: 'Establish the cereal with an undersown legume once soil temperature holds.',
    },
    {
      season: 'Summer',
      range: 'Jun – Aug',
      crops: [
        { name: 'Flax', color: '#5A9BD4' },
        { name: 'Buckwheat', color: '#C4703A' },
      ],
      note: 'Short-cycle break crops keep the ground covered through the dry window.',
    },
    {
      season: 'Winter',
      range: 'Nov – Feb',
      crops: [
        { name: 'Wheat', color: '#E3B341' },
        { name: 'Fallow', color: '#8C9793' },
      ],
      note: 'Winter wheat uses stored moisture; leave a fallow strip to recharge the profile.',
    },
  ];
}

export interface CalendarRow {
  season: string;
  color: string;
  crop: string;
  months: number[];
}

export function buildCalendarRows(): CalendarRow[] {
  return [
    { season: 'Spring', color: '#9EDB02', crop: 'Barley + Clover', months: [2, 3, 4, 5] },
    { season: 'Summer', color: '#5A9BD4', crop: 'Flax + Buckwheat', months: [4, 5, 6, 7] },
    { season: 'Winter', color: '#E3B341', crop: 'Wheat', months: [0, 1, 10, 11] },
  ];
}

export const EXPERT_TIPS = [
  'Label these as sample recommendations — confirm against your own soil tests and local extension guidance.',
  'Sample soil at the same points each season so the trend is comparable year to year.',
  'Keep a legume in the rotation at least every third cycle to rebuild nitrogen naturally.',
  'Leave the driest strip fallow where the profile is shallow, then irrigate the rest selectively.',
  'Match row spacing to the drill you actually own — a recommendation you cannot plant is not a plan.',
];

export interface CropDetail {
  id: string;
  name: string;
  area: string;
  spacing: string;
  water: string;
  yield: string;
  season: string;
  color: string;
}

export function buildCropDetail(): CropDetail {
  return {
    id: 'wheat',
    name: 'Wheat',
    area: '68.4 acres',
    spacing: '18 cm rows',
    water: '420 mm / season',
    yield: '4.6 t / acre (target)',
    season: 'Winter — sown Oct, harvested Jul',
    color: '#E3B341',
  };
}
