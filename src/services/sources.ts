import type { DataSourceRef } from '@/types';

export const DATA_SOURCES = {
  satelliteImagery: {
    id: 'eox-s2cloudless',
    label: 'Sentinel-2 cloudless basemap',
    provider: 'EOX / European Space Agency',
    url: 'https://s2maps.eu',
    license: 'CC BY-NC-SA 4.0 (imagery: ESA Copernicus)',
    note: 'True-colour Sentinel-2 mosaic, 10 m nominal resolution.',
  },
  sentinelCatalog: {
    id: 'element84-earth-search',
    label: 'Sentinel-2 L2A catalogue',
    provider: 'Element 84 Earth Search (AWS Open Data)',
    url: 'https://earth-search.aws.element84.com/v1',
    license: 'Copernicus Sentinel Data Terms',
    note: 'STAC catalogue used to locate the most recent low-cloud acquisition.',
  },
  sentinelCogs: {
    id: 'sentinel-cogs',
    label: 'Sentinel-2 L2A COG bands (B04/B08)',
    provider: 'AWS Open Data — sentinel-cogs',
    url: 'https://registry.opendata.aws/sentinel-2-l2a-cogs/',
    license: 'Copernicus Sentinel Data Terms',
    note: 'Red and near-infrared surface-reflectance bands read client-side to derive NDVI.',
  },
  soilGrids: {
    id: 'isric-soilgrids',
    label: 'ISRIC SoilGrids v2.0',
    provider: 'ISRIC — World Soil Information',
    url: 'https://www.isric.org/explore/soilgrids',
    license: 'CC BY 4.0',
    note: 'Global gridded soil properties at 250 m, multiple depth intervals.',
  },
  openMeteoForecast: {
    id: 'open-meteo-forecast',
    label: 'Open-Meteo weather & soil moisture',
    provider: 'Open-Meteo',
    url: 'https://open-meteo.com',
    license: 'CC BY 4.0',
    note: 'Forecast air temperature, precipitation, ET₀ and modelled soil moisture.',
  },
  openMeteoArchive: {
    id: 'open-meteo-archive',
    label: 'Open-Meteo ERA5 archive',
    provider: 'Open-Meteo / ECMWF ERA5',
    url: 'https://open-meteo.com/en/docs/historical-weather-api',
    license: 'CC BY 4.0',
    note: 'Reanalysis history used for rainfall, temperature trends and climate anomalies.',
  },
  openMeteoAir: {
    id: 'open-meteo-air-quality',
    label: 'Open-Meteo air quality (CAMS)',
    provider: 'Open-Meteo / Copernicus CAMS',
    url: 'https://open-meteo.com/en/docs/air-quality-api',
    license: 'CC BY 4.0',
    note: 'Modelled PM2.5 and PM10 near-surface concentrations.',
  },
  openStreetMap: {
    id: 'openstreetmap-nominatim',
    label: 'OpenStreetMap place search',
    provider: 'OpenStreetMap Foundation (Nominatim)',
    url: 'https://nominatim.openstreetmap.org',
    license: 'ODbL 1.0',
    note: 'Forward geocoding for the Earth Explorer location search.',
  },
  rulesEngine: {
    id: 'agrisense-rules-engine',
    label: 'AgriSense deterministic crop rules engine',
    provider: 'AgriSense',
    note: 'Deterministic agronomic rule evaluation over the crop profile dataset.',
  },
  rulesDataset: {
    id: 'agrisense-crop-dataset',
    label: 'AgriSense crop profile dataset (demonstration)',
    provider: 'AgriSense',
    note: 'Labelled demonstration profiles. Replace with the connected rules-engine dataset when available.',
  },
  aiExplainer: {
    id: 'agrisense-ai-explainer',
    label: 'AI explanation layer',
    provider: 'AgriSense',
    note: 'Explains rule-approved candidates only. Never selects crops.',
  },
} as const satisfies Record<string, DataSourceRef>;

export type DataSourceKey = keyof typeof DATA_SOURCES;

export function sourceWithRetrieval(key: DataSourceKey, retrievedAt = new Date().toISOString()): DataSourceRef {
  return { ...DATA_SOURCES[key], retrievedAt };
}

export const SATELLITE_ATTRIBUTION =
  'Imagery: ESA Copernicus Sentinel-2 cloudless (EOX) · Soil: ISRIC SoilGrids · Weather: Open-Meteo · Places: OpenStreetMap';
