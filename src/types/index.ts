export interface LngLat {
  lng: number;
  lat: number;
}

export type DataOrigin = 'live' | 'derived' | 'demo' | 'unavailable';

export interface DataSourceRef {
  id: string;
  label: string;
  /** Human-readable provider, e.g. "ISRIC SoilGrids v2.0" */
  provider: string;
  url?: string;
  license?: string;
  /** ISO timestamp of retrieval, when known. */
  retrievedAt?: string;
  /** ISO timestamp describing the data epoch (e.g. imagery acquisition). */
  dataDate?: string;
  note?: string;
}

export interface DataEnvelope<T> {
  status: 'ok' | 'error' | 'unavailable' | 'loading';
  origin: DataOrigin;
  data: T | null;
  source: DataSourceRef;
  message?: string;
  /** Set when the demo dataset is used in place of a live provider. */
  isDemonstration?: boolean;
}

/* ------------------------------- Fields ---------------------------------- */

export type FieldStatus = 'draft' | 'analyzing' | 'ready' | 'error';

export interface FieldBoundary {
  /** Open or closed ring of vertices in drawing order. */
  coords: LngLat[];
  areaM2: number;
  perimeterM: number;
  centroid: LngLat;
  bbox: [number, number, number, number];
  vertexCount: number;
}

export interface Field {
  id: string;
  name: string;
  createdAt: string;
  status: FieldStatus;
  boundary: FieldBoundary;
  locationLabel: string;
  country?: string;
  /** SoilGrids-derived texture class, filled during analysis. */
  soilTexture?: string;
  notes?: string;
  isSample?: boolean;
}

/* ------------------------------ Analysis --------------------------------- */

export type AnalysisStageId =
  | 'boundary'
  | 'imagery'
  | 'vegetation'
  | 'soil'
  | 'climate'
  | 'suitability'
  | 'crops';

export type StageState = 'pending' | 'active' | 'done' | 'unavailable' | 'error';

export interface AnalysisStage {
  id: AnalysisStageId;
  label: string;
  description: string;
  state: StageState;
  detail?: string;
  source?: string;
  startedAt?: number;
  finishedAt?: number;
}

/* ----------------------------- Vegetation -------------------------------- */

export interface NdviStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  p10: number;
  p90: number;
  /** Fraction of valid pixels in each health band. */
  bands: NdviBandFractions;
  validPixels: number;
  totalPixels: number;
}

export interface NdviBandFractions {
  healthy: number;
  good: number;
  moderate: number;
  poor: number;
  stressed: number;
  nodata: number;
}

export interface NdviGrid {
  width: number;
  height: number;
  /** Row-major NDVI values in [-1, 1] or null for nodata. */
  values: Array<number | null>;
}

export interface VegetationResult {
  stats: NdviStats;
  grid: NdviGrid;
  /** Screen-space overlay geometry produced by sampling the raster to the map. */
  overlay: NdviOverlayGeometry;
  item: SatelliteItem;
  /** Mean NDVI delta against the previous comparable acquisition, when available. */
  change?: { delta: number; previousDate: string; previousMean: number } | null;
}

export interface NdviOverlayGeometry {
  type: 'polygon-grid';
  bbox: [number, number, number, number];
  cols: number;
  rows: number;
  /** rows x cols cells, row-major, each a hex colour or null. */
  colors: Array<string | null>;
}

export interface SatelliteItem {
  id: string;
  collection: string;
  platform: string;
  datetime: string;
  cloudCover: number;
  bbox: [number, number, number, number];
  assets: {
    red?: string;
    nir?: string;
    visual?: string;
    thumbnail?: string;
  };
  tileId: string;
}

/* -------------------------------- Soil ----------------------------------- */

export interface SoilProperty {
  id: string;
  label: string;
  /** Value converted to target_units. */
  value: number | null;
  unit: string;
  depth: string;
  source: string;
  /** SoilGrids mapped unit before conversion. */
  mappedValue?: number | null;
  mappedUnit?: string;
  description: string;
  /** Sensible agronomic range for a compact visual band. */
  range?: [number, number];
  /** Higher-is-better, lower-is-better or neutral for interpretation colour. */
  polarity?: 'higher' | 'lower' | 'neutral';
}

export interface SoilProfile {
  properties: SoilProperty[];
  texture?: { label: string; components: SoilComponent[] };
  retrievedAt: string;
}

export interface SoilComponent {
  label: string;
  fraction: number | null;
  unit: string;
}

/* ------------------------------- Climate --------------------------------- */

export interface ClimateDay {
  date: string;
  precipitationMm: number | null;
  tempMaxC: number | null;
  tempMinC: number | null;
  tempMeanC: number | null;
  et0Mm: number | null;
  soilMoistureSurface: number | null;
  soilMoistureDeep: number | null;
}

export interface ClimateAnomaly {
  id: string;
  label: string;
  value: number;
  unit: string;
  baseline: number;
  severity: 'low' | 'moderate' | 'high';
  description: string;
}

export interface AirQuality {
  pm25: number | null;
  pm10: number | null;
  retrievedAt: string;
  aqiLabel: string;
}

export interface ClimateProfile {
  days: ClimateDay[];
  annualRainfallMm: number | null;
  rainfallPeriodLabel: string;
  tempRange: { minC: number | null; maxC: number | null };
  totalEt0Mm: number | null;
  anomalies: ClimateAnomaly[];
  airQuality: AirQuality | null;
  soilMoistureSeries: Array<{ date: string; surface: number | null; deep: number | null }>;
}

/* -------------------------------- Crops ---------------------------------- */

export interface CropProfile {
  id: string;
  name: string;
  scientificName?: string;
  category: 'cereal' | 'pulse' | 'oilseed' | 'vegetable' | 'fruit' | 'tree' | 'fodder' | 'fibre' | 'root';
  waterRequirementMm: { min: number; max: number };
  waterClass: 'very-low' | 'low' | 'moderate' | 'high' | 'very-high';
  optimalPh: [number, number];
  toleratedPh: [number, number];
  optimalTempC: [number, number];
  absoluteTempC: [number, number];
  soilTextures: string[];
  plantingMonths: number[];
  harvestMonths: number[];
  cycleDays: number;
  droughtTolerance: 'low' | 'moderate' | 'high';
  salinityTolerance: 'low' | 'moderate' | 'high';
  drainageNeed: 'low' | 'moderate' | 'high';
  notes: string;
}

export type SuitabilityVerdict = 'recommended' | 'conditional' | 'rejected';

export interface SuitabilityFactor {
  id: 'water' | 'soil' | 'climate' | 'season' | 'ph' | 'texture';
  label: string;
  score: number;
  weight: number;
  detail: string;
  verdict: 'pass' | 'marginal' | 'fail';
}

export interface CropEvaluation {
  crop: CropProfile;
  score: number;
  verdict: SuitabilityVerdict;
  factors: SuitabilityFactor[];
  constraints: string[];
  rationale: string;
}

export interface CropEvaluationResult {
  evaluations: CropEvaluation[];
  recommended: CropEvaluation[];
  conditional: CropEvaluation[];
  rejected: CropEvaluation[];
  engineId: string;
  engineVersion: string;
  datasetSize: number;
  origin: DataOrigin;
  evaluatedAt: string;
  fieldContext: RulesFieldContext;
}

export interface RulesFieldContext {
  areaM2: number;
  meanNdvi: number | null;
  soilPh: number | null;
  organicCarbon: number | null;
  clayFraction: number | null;
  sandFraction: number | null;
  annualRainfallMm: number | null;
  et0Mm: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  textureLabel: string | null;
  waterBalanceMm: number | null;
}

/* --------------------------- Rules-first AI plan -------------------------- */

export interface CropZone {
  id: string;
  cropId: string;
  cropName: string;
  color: string;
  /** Fraction of field area, 0..1 */
  share: number;
  areaM2: number;
  waterNeedMm: number;
  rationale: string;
  coords: LngLat[];
  centroid: LngLat;
  verdict: SuitabilityVerdict;
}

export interface RotationSlot {
  season: 'spring' | 'summer' | 'autumn-winter';
  months: number[];
  cropId: string;
  cropName: string;
  color: string;
  waterMm: number;
  note: string;
}

export interface GuardrailCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface AiPlanNarrative {
  headline: string;
  summary: string;
  reasoning: string[];
  cautions: string[];
}

export interface AiPlan {
  status: 'ok' | 'unavailable';
  provider: string;
  model: string;
  narrative: AiPlanNarrative | null;
  guardrails: GuardrailCheck[];
  guardrailsPassed: boolean;
  message?: string;
}

export interface PlanningResult {
  zones: CropZone[];
  rotation: RotationSlot[];
  aiPlan: AiPlan;
  projectedWaterReductionPct: number | null;
  projectedRevenueDeltaPct: number | null;
  recommendations: string[];
  isSample: boolean;
}

/* ------------------------------- Decision -------------------------------- */

export interface DecisionEvidence {
  id: string;
  label: string;
  value: string;
  interpretation: string;
  weight: 'primary' | 'supporting' | 'counter';
  source: string;
}

export interface IrrigationDecision {
  id: string;
  question: string;
  verdict: string;
  action: string;
  confidence: number;
  confidenceLabel: string;
  evidence: DecisionEvidence[];
  uncertainty: string[];
  generatedAt: string;
  scenarioLabel: string;
  isIllustrative: boolean;
}

/* ------------------------------ App shell -------------------------------- */

export interface MapViewState {
  center: LngLat;
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface SearchResult {
  id: string;
  name: string;
  subtitle: string;
  center: LngLat;
  bbox?: [number, number, number, number];
  kind: 'place' | 'farm' | 'sample';
  zoom?: number;
}
