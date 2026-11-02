import type { LngLat, SoilProfile, SoilProperty, SoilComponent } from '@/types';
import { fetchJson, describeError } from '@/services/http';
import { sourceWithRetrieval } from '@/services/sources';

const SOILGRIDS_ENDPOINT = 'https://rest.isric.org/soilgrids/v2.0/properties/query';

interface SoilGridsLayerValue {
  mean: number | null;
}
interface SoilGridsDepth {
  range: { top_depth: number; bottom_depth: number; unit_depth: string };
  label: string;
  values: SoilGridsLayerValue;
}
interface SoilGridsLayer {
  name: string;
  unit_measure: { d_factor: number; mapped_units: string; target_units: string };
  depths: SoilGridsDepth[];
}
interface SoilGridsResponse {
  properties: { layers: SoilGridsLayer[] };
}

interface PropertyDefinition {
  id: string;
  label: string;
  unit: string;
  depth: string;
  description: string;
  range?: [number, number];
  polarity: 'higher' | 'lower' | 'neutral';
}

/** SoilGrids properties with the depth interval used for the agronomic reading. */
const PROPERTY_DEFINITIONS: Record<string, PropertyDefinition> = {
  phh2o: {
    id: 'phh2o',
    label: 'Soil pH (H₂O)',
    unit: 'pH',
    depth: '0–5 cm',
    description: 'Acidity or alkalinity of the topsoil, which drives nutrient availability.',
    range: [4.5, 9],
    polarity: 'neutral',
  },
  soc: {
    id: 'soc',
    label: 'Soil organic carbon',
    unit: 'g/kg',
    depth: '0–5 cm',
    description: 'Carbon held in soil organic matter — a core fertility and structure indicator.',
    range: [0, 60],
    polarity: 'higher',
  },
  nitrogen: {
    id: 'nitrogen',
    label: 'Total nitrogen',
    unit: 'g/kg',
    depth: '0–5 cm',
    description: 'Total soil nitrogen that drives crop protein formation.',
    range: [0, 5],
    polarity: 'higher',
  },
  clay: {
    id: 'clay',
    label: 'Clay fraction',
    unit: '%',
    depth: '0–5 cm',
    description: 'Fine particles that control water retention and nutrient holding capacity.',
    range: [0, 60],
    polarity: 'neutral',
  },
  sand: {
    id: 'sand',
    label: 'Sand fraction',
    unit: '%',
    depth: '0–5 cm',
    description: 'Coarse particles that control drainage and aeration.',
    range: [0, 100],
    polarity: 'neutral',
  },
  silt: {
    id: 'silt',
    label: 'Silt fraction',
    unit: '%',
    depth: '0–5 cm',
    description: 'Intermediate particles that influence workability and moisture.',
    range: [0, 80],
    polarity: 'neutral',
  },
  cec: {
    id: 'cec',
    label: 'Cation exchange capacity',
    unit: 'cmol(c)/kg',
    depth: '0–5 cm',
    description: 'Capacity to hold exchangeable cations — the soil nutrient buffer.',
    range: [0, 40],
    polarity: 'higher',
  },
  wv0010: {
    id: 'wv0010',
    label: 'Water retention at 10 kPa',
    unit: 'cm³/100cm³',
    depth: '0–5 cm',
    description: 'Volumetric water content at field capacity (pF 2.0).',
    range: [0, 55],
    polarity: 'higher',
  },
  wv0033: {
    id: 'wv0033',
    label: 'Water retention at 33 kPa',
    unit: 'cm³/100cm³',
    depth: '0–5 cm',
    description: 'Volumetric water content retained after drainage (pF 2.5).',
    range: [0, 50],
    polarity: 'higher',
  },
  wv1500: {
    id: 'wv1500',
    label: 'Water retention at 1500 kPa',
    unit: 'cm³/100cm³',
    depth: '0–5 cm',
    description: 'Permanent wilting point — water unavailable to most crops (pF 4.2).',
    range: [0, 30],
    polarity: 'lower',
  },
};

const QUERY_PROPERTIES = Object.keys(PROPERTY_DEFINITIONS);

export function soilGridsUrl(coord: LngLat): string {
  const params = new URLSearchParams();
  params.set('lon', coord.lng.toFixed(5));
  params.set('lat', coord.lat.toFixed(5));
  params.set('value', 'mean');
  params.set('depth', '0-5cm');
  QUERY_PROPERTIES.forEach((property) => params.append('property', property));
  return `${SOILGRIDS_ENDPOINT}?${params.toString()}`;
}

/** USDA-style texture class from the SoilGrids clay/silt/sand fractions. */
function textureFromFractions(
  clay: number | null,
  sand: number | null,
  silt: number | null,
): string | undefined {
  if (clay === null || sand === null || silt === null) return undefined;
  const total = clay + sand + silt;
  if (total <= 0) return undefined;
  const c = (clay / total) * 100;
  const s = (sand / total) * 100;
  const si = (silt / total) * 100;
  if (si >= 80) return 'Silt';
  if (c >= 40 && si >= 40) return 'Silty clay';
  if (c >= 40 && s <= 45) return 'Clay';
  if (c >= 35 && s > 45) return 'Sandy clay';
  if (c >= 20 && c < 35 && si >= 28) return 'Clay loam';
  if (c < 20 && si >= 50) return 'Silt loam';
  if (s >= 85) return 'Sand';
  if (s >= 70 && c < 15) return 'Loamy sand';
  if (s >= 43 && c < 20) return 'Sandy loam';
  return 'Loam';
}

export interface SoilQueryResult {
  profile: SoilProfile;
}

/**
 * Retrieve real soil properties from ISRIC SoilGrids v2.0 at the field centroid.
 * Mapped values are converted to target units with the layer d_factor.
 */
export async function fetchSoilProfile(coord: LngLat, signal?: AbortSignal): Promise<SoilQueryResult> {
  const raw = await fetchJson<SoilGridsResponse>(soilGridsUrl(coord), { timeoutMs: 25000, signal });
  const layers = raw.properties?.layers ?? [];
  if (!layers.length) throw new Error('SoilGrids returned no layers for this location.');

  const properties: SoilProperty[] = [];
  const byId = new Map<string, number | null>();

  for (const layer of layers) {
    const definition = PROPERTY_DEFINITIONS[layer.name];
    if (!definition) continue;
    const depth = layer.depths?.[0];
    const mappedValue = depth?.values?.mean ?? null;
    const factor = layer.unit_measure?.d_factor || 1;
    const value = mappedValue === null ? null : mappedValue / factor;
    byId.set(layer.name, value);
    properties.push({
      id: definition.id,
      label: definition.label,
      value,
      unit:
        layer.unit_measure?.target_units && layer.unit_measure.target_units !== '-'
          ? layer.unit_measure.target_units
          : definition.unit,
      depth: depth?.label ?? definition.depth,
      source: 'ISRIC SoilGrids v2.0',
      mappedValue,
      mappedUnit: layer.unit_measure?.mapped_units,
      description: definition.description,
      range: definition.range,
      polarity: definition.polarity,
    });
  }

  if (!properties.length) {
    throw new Error('SoilGrids returned no supported soil properties for this location.');
  }

  const clay = byId.get('clay') ?? null;
  const sand = byId.get('sand') ?? null;
  const silt = byId.get('silt') ?? null;
  const textureLabel = textureFromFractions(clay, sand, silt);

  const components: SoilComponent[] = [
    { label: 'Clay', fraction: clay === null ? null : clay / 100, unit: '%' },
    { label: 'Silt', fraction: silt === null ? null : silt / 100, unit: '%' },
    { label: 'Sand', fraction: sand === null ? null : sand / 100, unit: '%' },
  ];

  return {
    profile: {
      properties,
      texture: textureLabel ? { label: textureLabel, components } : undefined,
      retrievedAt: new Date().toISOString(),
    },
  };
}

export function soilSource() {
  return sourceWithRetrieval('soilGrids');
}

export function soilErrorMessage(error: unknown): string {
  return `SoilGrids is unavailable for this location. ${describeError(error)}`;
}
