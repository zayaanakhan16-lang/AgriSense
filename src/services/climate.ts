import type { AirQuality, ClimateAnomaly, ClimateDay, ClimateProfile, LngLat } from '@/types';
import { fetchJson } from '@/services/http';
import { sourceWithRetrieval } from '@/services/sources';

const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_ENDPOINT = 'https://archive-api.open-meteo.com/v1/archive';
const AIR_ENDPOINT = 'https://air-quality-api.open-meteo.com/v1/air-quality';

const DAILY_VARS = [
  'precipitation_sum',
  'temperature_2m_max',
  'temperature_2m_min',
  'temperature_2m_mean',
  'et0_fao_evapotranspiration',
  'soil_moisture_0_to_7cm_mean',
  'soil_moisture_28_to_100cm_mean',
].join(',');

interface DailyResponse {
  daily?: {
    time: string[];
    precipitation_sum?: Array<number | null>;
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    temperature_2m_mean?: Array<number | null>;
    et0_fao_evapotranspiration?: Array<number | null>;
    soil_moisture_0_to_7cm_mean?: Array<number | null>;
    soil_moisture_28_to_100cm_mean?: Array<number | null>;
  };
}

interface AirResponse {
  current?: { time?: string; pm2_5?: number | null; pm10?: number | null };
}

function num(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function buildDays(response: DailyResponse): ClimateDay[] {
  const daily = response.daily;
  if (!daily?.time?.length) return [];
  return daily.time.map((date, index) => ({
    date,
    precipitationMm: num(daily.precipitation_sum?.[index]),
    tempMaxC: num(daily.temperature_2m_max?.[index]),
    tempMinC: num(daily.temperature_2m_min?.[index]),
    tempMeanC: num(daily.temperature_2m_mean?.[index]),
    et0Mm: num(daily.et0_fao_evapotranspiration?.[index]),
    soilMoistureSurface: num(daily.soil_moisture_0_to_7cm_mean?.[index]),
    soilMoistureDeep: num(daily.soil_moisture_28_to_100cm_mean?.[index]),
  }));
}

function sumOf(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => v !== null);
  return valid.length ? valid.reduce((acc, v) => acc + v, 0) : null;
}

function meanOf(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => v !== null);
  return valid.length ? valid.reduce((acc, v) => acc + v, 0) / valid.length : null;
}

function stdevOf(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function buildAnomalies(history: ClimateDay[], recent: ClimateDay[]): ClimateAnomaly[] {
  const anomalies: ClimateAnomaly[] = [];
  const histRain = history.map((d) => d.precipitationMm).filter((v): v is number => v !== null);
  const histTemp = history.map((d) => d.tempMeanC).filter((v): v is number => v !== null);
  const recentRain = sumOf(recent.map((d) => d.precipitationMm));
  const recentTemp = meanOf(recent.map((d) => d.tempMeanC));

  if (histRain.length >= 30 && recentRain !== null) {
    const windowDays = Math.max(1, recent.length);
    const perDayBaseline = histRain.reduce((acc, v) => acc + v, 0) / histRain.length;
    const baseline = perDayBaseline * windowDays;
    const deviation = recentRain - baseline;
    const relative = baseline > 0 ? Math.abs(deviation) / baseline : 0;
    anomalies.push({
      id: 'rainfall',
      label: 'Rainfall vs 12-month norm',
      value: recentRain,
      unit: 'mm',
      baseline,
      severity: relative > 0.5 ? 'high' : relative > 0.25 ? 'moderate' : 'low',
      description:
        deviation >= 0
          ? 'Rainfall over the recent window is at or above the trailing 12-month norm.'
          : 'Rainfall over the recent window is below the trailing 12-month norm.',
    });
  }

  if (histTemp.length >= 30 && recentTemp !== null) {
    const baseline = histTemp.reduce((acc, v) => acc + v, 0) / histTemp.length;
    const deviation = recentTemp - baseline;
    const sd = stdevOf(histTemp);
    anomalies.push({
      id: 'temperature',
      label: 'Mean temperature anomaly',
      value: deviation,
      unit: '°C',
      baseline,
      severity: sd > 0 && Math.abs(deviation) > 1.5 * sd ? 'high' : sd > 0 && Math.abs(deviation) > 0.8 * sd ? 'moderate' : 'low',
      description:
        deviation >= 0
          ? 'The recent mean temperature is warmer than the trailing 12-month norm.'
          : 'The recent mean temperature is cooler than the trailing 12-month norm.',
    });
  }

  return anomalies;
}

export function aqiLabelFor(pm25: number | null): string {
  if (pm25 === null) return 'Unavailable';
  if (pm25 <= 12) return 'Good';
  if (pm25 <= 35.4) return 'Moderate';
  if (pm25 <= 55.4) return 'Unhealthy for sensitive groups';
  if (pm25 <= 150.4) return 'Unhealthy';
  if (pm25 <= 250.4) return 'Very unhealthy';
  return 'Hazardous';
}

function buildUrl(endpoint: string, coord: LngLat, params: Record<string, string>): string {
  const search = new URLSearchParams({
    latitude: coord.lat.toFixed(5),
    longitude: coord.lng.toFixed(5),
    timezone: 'auto',
    ...params,
  });
  return `${endpoint}?${search.toString()}`;
}

export interface ClimateFetchResult {
  profile: ClimateProfile;
  /** Which of the three upstream calls actually succeeded. */
  availability: { forecast: boolean; archive: boolean; air: boolean };
}

/**
 * Retrieve climate intelligence from Open-Meteo: 12 months of ERA5 reanalysis history
 * (rainfall, temperature, ET₀), a 16-day forecast with modelled soil moisture, and
 * current CAMS air quality. The three calls are independent and degrade separately.
 */
export async function fetchClimateProfile(coord: LngLat, signal?: AbortSignal): Promise<ClimateFetchResult> {
  const end = new Date();
  const start = new Date(end.getTime() - 365 * 86400000);
  const iso = (d: Date): string => d.toISOString().slice(0, 10);

  const forecastUrl = buildUrl(FORECAST_ENDPOINT, coord, { daily: DAILY_VARS, forecast_days: '16' });
  const archiveUrl = buildUrl(ARCHIVE_ENDPOINT, coord, {
    daily: DAILY_VARS,
    start_date: iso(start),
    end_date: iso(end),
  });
  const airUrl = buildUrl(AIR_ENDPOINT, coord, { current: 'pm2_5,pm10' });

  const [forecast, archive, air] = await Promise.allSettled([
    fetchJson<DailyResponse>(forecastUrl, { timeoutMs: 20000, signal, retries: 2 }),
    fetchJson<DailyResponse>(archiveUrl, { timeoutMs: 25000, signal, retries: 2 }),
    fetchJson<AirResponse>(airUrl, { timeoutMs: 15000, signal, retries: 1 }),
  ]);

  const forecastDays = forecast.status === 'fulfilled' ? buildDays(forecast.value) : [];
  const historyDays = archive.status === 'fulfilled' ? buildDays(archive.value) : [];
  const days = [...historyDays, ...forecastDays].sort((a, b) => a.date.localeCompare(b.date));

  if (!days.length) throw new Error('Open-Meteo returned no climate records for this location.');

  const history = historyDays.length ? historyDays : forecastDays;
  const recentWindow = (forecastDays.length ? forecastDays : historyDays).slice(0, 16);

  const tempValues = days.flatMap((d) => [d.tempMinC, d.tempMaxC]).filter((v): v is number => v !== null);

  let airQuality: AirQuality | null = null;
  if (air.status === 'fulfilled' && air.value.current) {
    const pm25 = num(air.value.current.pm2_5);
    airQuality = {
      pm25,
      pm10: num(air.value.current.pm10),
      retrievedAt: air.value.current.time ?? new Date().toISOString(),
      aqiLabel: aqiLabelFor(pm25),
    };
  }

  const profile: ClimateProfile = {
    days,
    annualRainfallMm: sumOf(history.map((d) => d.precipitationMm)),
    rainfallPeriodLabel: history.length ? `${history[0].date} → ${history[history.length - 1].date}` : 'Unavailable',
    tempRange: {
      minC: tempValues.length ? Math.min(...tempValues) : null,
      maxC: tempValues.length ? Math.max(...tempValues) : null,
    },
    totalEt0Mm: sumOf(days.map((d) => d.et0Mm)),
    anomalies: buildAnomalies(history, recentWindow),
    airQuality,
    soilMoistureSeries: days
      .filter((d) => d.soilMoistureSurface !== null || d.soilMoistureDeep !== null)
      .slice(-60)
      .map((d) => ({ date: d.date, surface: d.soilMoistureSurface, deep: d.soilMoistureDeep })),
  };

  return {
    profile,
    availability: {
      forecast: forecast.status === 'fulfilled',
      archive: archive.status === 'fulfilled',
      air: air.status === 'fulfilled',
    },
  };
}

export function climateSources() {
  return {
    forecast: sourceWithRetrieval('openMeteoForecast'),
    archive: sourceWithRetrieval('openMeteoArchive'),
    air: sourceWithRetrieval('openMeteoAir'),
  };
}

/** Annual rainfall minus the annualised reference evapotranspiration, when both are known. */
export function waterBalanceMm(profile: ClimateProfile): number | null {
  if (profile.annualRainfallMm === null || profile.totalEt0Mm === null) return null;
  const observedDays = profile.days.filter((d) => d.et0Mm !== null).length;
  if (observedDays < 30) return null;
  const annualEt0 = (profile.totalEt0Mm / observedDays) * 365;
  return profile.annualRainfallMm - annualEt0;
}
