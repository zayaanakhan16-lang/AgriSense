import type {
  AnalysisStageId,
  ClimateProfile,
  CropEvaluationResult,
  CropEvaluation,
  DataSourceRef,
  Field,
  PlanningResult,
  SatelliteItem,
  SoilProfile,
  StageState,
  VegetationResult,
} from '@/types';
import { describeError } from '@/services/http';
import { DATA_SOURCES, sourceWithRetrieval } from '@/services/sources';
import { computeNdvi, searchSentinelItems } from '@/services/satellite/ndvi';
import { fetchSoilProfile } from '@/services/soil';
import { fetchClimateProfile, waterBalanceMm } from '@/services/climate';
import { evaluateCrops } from '@/services/rulesEngine';
import {
  buildCropZones,
  buildRotation,
  requestAiExplanation,
  rulesDerivedRecommendations,
  validatePlan,
} from '@/services/planning';
import { areaInAcres } from '@/lib/format';

export const ZONE_COLORS = ['#A8E600', '#D7FF54', '#0A6A4F', '#3E9E7C', '#C2F03A'];

export interface StagePatch {
  state?: StageState;
  detail?: string;
  source?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface StageResult<T> {
  value: T | null;
  error: string | null;
  source: DataSourceRef;
}

export interface AnalysisOutcome {
  satellite: StageResult<SatelliteItem[]>;
  vegetation: StageResult<VegetationResult>;
  soil: StageResult<SoilProfile>;
  climate: StageResult<ClimateProfile>;
  evaluation: StageResult<CropEvaluationResult>;
  planning: StageResult<PlanningResult>;
}

export interface RunAnalysisOptions {
  onStage: (id: AnalysisStageId, patch: StagePatch) => void;
  signal?: AbortSignal;
  referenceMonth?: number;
  /** Reuse already-fetched soil and climate instead of refetching them. */
  reuse?: { soil?: SoilProfile | null; climate?: ClimateProfile | null };
}

/** Basic geometric validation performed on the drawn boundary before anything else runs. */
function validateBoundary(field: Field): { ok: boolean; detail: string } {
  const { coords, areaM2, vertexCount } = field.boundary;
  if (vertexCount < 3) return { ok: false, detail: 'A boundary needs at least three vertices.' };
  if (areaM2 < 100) {
    return { ok: false, detail: `The boundary encloses only ${areaM2.toFixed(0)} m² — too small for field analysis.` };
  }
  const unique = new Set(coords.map((c) => `${c.lng.toFixed(6)},${c.lat.toFixed(6)}`));
  if (unique.size < 3) return { ok: false, detail: 'The boundary vertices are not distinct.' };
  return {
    ok: true,
    detail: `${vertexCount} vertices · ${(areaM2 / 10000).toFixed(2)} ha (${areaInAcres(areaM2).toFixed(2)} ac) · ring closed`,
  };
}

/** Choose up to three approved crops and weight their area share by rules-engine score. */
export function chooseAllocations(evaluation: CropEvaluationResult, maxZones = 3): CropEvaluation[] {
  const approved = [...evaluation.recommended, ...evaluation.conditional];
  if (!approved.length) return [];
  const chosen = approved.slice(0, maxZones);
  return chosen;
}

function allocationShares(chosen: CropEvaluation[]): number[] {
  const weights = chosen.map((c) => Math.max(0.1, c.score));
  const total = weights.reduce((acc, w) => acc + w, 0);
  return weights.map((w) => w / total);
}

/**
 * Execute the full field-analysis pipeline.
 *
 * Every stage callback fires only when the corresponding real operation has actually
 * completed. Failures are reported as `unavailable` or `error` — never as success — and
 * the pipeline continues so that partial intelligence is still shown honestly.
 */
export async function runFieldAnalysis(field: Field, options: RunAnalysisOptions): Promise<AnalysisOutcome> {
  const { onStage, signal, referenceMonth, reuse } = options;
  const bbox = field.boundary.bbox;
  const boundaryRing = field.boundary.coords;

  const outcome: AnalysisOutcome = {
    satellite: { value: null, error: null, source: sourceWithRetrieval('sentinelCatalog') },
    vegetation: { value: null, error: null, source: sourceWithRetrieval('sentinelCogs') },
    soil: { value: reuse?.soil ?? null, error: null, source: sourceWithRetrieval('soilGrids') },
    climate: { value: reuse?.climate ?? null, error: null, source: sourceWithRetrieval('openMeteoArchive') },
    evaluation: { value: null, error: null, source: DATA_SOURCES.rulesEngine },
    planning: { value: null, error: null, source: DATA_SOURCES.aiExplainer },
  };

  /* ---------------------------------------------------------------- 1. boundary */
  onStage('boundary', { state: 'active', startedAt: Date.now() });
  const boundary = validateBoundary(field);
  onStage('boundary', {
    state: boundary.ok ? 'done' : 'error',
    detail: boundary.detail,
    finishedAt: Date.now(),
  });
  if (!boundary.ok) {
    return outcome;
  }

  /* ----------------------------------------------------------------- 2. imagery */
  onStage('imagery', { state: 'active', startedAt: Date.now() });
  let items: SatelliteItem[] = [];
  try {
    items = await searchSentinelItems(bbox, { maxCloudCover: 60, lookbackDays: 120, signal });
    outcome.satellite.value = items;
    if (!items.length) {
      outcome.satellite.error = 'No Sentinel-2 acquisition intersected this footprint in the last 120 days.';
      onStage('imagery', {
        state: 'unavailable',
        detail: outcome.satellite.error,
        source: outcome.satellite.source.label,
        finishedAt: Date.now(),
      });
    } else {
      const best = items[0];
      onStage('imagery', {
        state: 'done',
        detail: `${items.length} acquisition${items.length === 1 ? '' : 's'} found · newest ${new Date(best.datetime).toISOString().slice(0, 10)} (${best.cloudCover.toFixed(1)}% cloud) · tile ${best.tileId}`,
        source: outcome.satellite.source.label,
        finishedAt: Date.now(),
      });
    }
  } catch (error) {
    outcome.satellite.error = describeError(error);
    onStage('imagery', {
      state: 'error',
      detail: outcome.satellite.error,
      source: outcome.satellite.source.label,
      finishedAt: Date.now(),
    });
  }

  /* -------------------------------------------------------------- 3. vegetation */
  onStage('vegetation', { state: 'active', startedAt: Date.now() });
  if (!items.length) {
    onStage('vegetation', {
      state: 'unavailable',
      detail: 'Vegetation indices require a satellite acquisition, which is not available for this footprint.',
      source: outcome.vegetation.source.label,
      finishedAt: Date.now(),
    });
  } else {
    try {
      const result = await computeNdvi(items[0], bbox, { signal, boundary: boundaryRing, withChange: true });
      outcome.vegetation.value = result;
      onStage('vegetation', {
        state: 'done',
        detail: `NDVI ${result.stats.mean.toFixed(3)} mean · ${result.stats.validPixels} valid pixels · ${new Date(result.item.datetime).toISOString().slice(0, 10)}${result.change ? ` · ${result.change.delta >= 0 ? '+' : ''}${result.change.delta.toFixed(3)} vs previous scene` : ''}`,
        source: outcome.vegetation.source.label,
        finishedAt: Date.now(),
      });
    } catch (error) {
      outcome.vegetation.error = describeError(error);
      onStage('vegetation', {
        state: 'unavailable',
        detail: outcome.vegetation.error,
        source: outcome.vegetation.source.label,
        finishedAt: Date.now(),
      });
    }
  }

  /* -------------------------------------------------------------------- 4. soil */
  onStage('soil', { state: 'active', startedAt: Date.now() });
  if (outcome.soil.value) {
    onStage('soil', {
      state: 'done',
      detail: 'Reused the soil profile already retrieved for this field.',
      source: outcome.soil.source.label,
      finishedAt: Date.now(),
    });
  } else {
    try {
      const { profile } = await fetchSoilProfile(field.boundary.centroid, signal);
      outcome.soil.value = profile;
      const withValues = profile.properties.filter((p) => p.value !== null).length;
      onStage('soil', {
        state: 'done',
        detail: `${withValues}/${profile.properties.length} properties retrieved at 0–5 cm${profile.texture ? ` · ${profile.texture.label}` : ''}`,
        source: outcome.soil.source.label,
        finishedAt: Date.now(),
      });
    } catch (error) {
      outcome.soil.error = describeError(error);
      onStage('soil', {
        state: 'unavailable',
        detail: outcome.soil.error,
        source: outcome.soil.source.label,
        finishedAt: Date.now(),
      });
    }
  }

  /* ----------------------------------------------------------------- 5. climate */
  onStage('climate', { state: 'active', startedAt: Date.now() });
  if (outcome.climate.value) {
    onStage('climate', {
      state: 'done',
      detail: 'Reused the climate history already retrieved for this field.',
      source: outcome.climate.source.label,
      finishedAt: Date.now(),
    });
  } else {
    try {
      const { profile, availability } = await fetchClimateProfile(field.boundary.centroid, signal);
      outcome.climate.value = profile;
      const missing = Object.entries(availability)
        .filter(([, ok]) => !ok)
        .map(([key]) => key);
      onStage('climate', {
        state: 'done',
        detail: `${profile.days.length} days prepared${profile.annualRainfallMm !== null ? ` · ${Math.round(profile.annualRainfallMm)} mm rainfall` : ''}${profile.tempRange.minC !== null && profile.tempRange.maxC !== null ? ` · ${profile.tempRange.minC.toFixed(0)} to ${profile.tempRange.maxC.toFixed(0)} °C` : ''}${missing.length ? ` · ${missing.join(', ')} unavailable` : ''}`,
        source: `${DATA_SOURCES.openMeteoArchive.label} + ${DATA_SOURCES.openMeteoForecast.label}`,
        finishedAt: Date.now(),
      });
    } catch (error) {
      outcome.climate.error = describeError(error);
      onStage('climate', {
        state: 'unavailable',
        detail: outcome.climate.error,
        source: outcome.climate.source.label,
        finishedAt: Date.now(),
      });
    }
  }

  /* ------------------------------------------------------------- 6. suitability */
  onStage('suitability', { state: 'active', startedAt: Date.now() });
  let evaluation: CropEvaluationResult | null = null;
  try {
    evaluation = evaluateCrops({
      field,
      vegetation: outcome.vegetation.value,
      soil: outcome.soil.value,
      climate: outcome.climate.value,
      referenceMonth,
    });
    outcome.evaluation.value = evaluation;
    const unavailableInputs = [
      outcome.vegetation.value ? null : 'vegetation',
      outcome.soil.value ? null : 'soil',
      outcome.climate.value ? null : 'climate',
    ].filter((v): v is string => Boolean(v));
    onStage('suitability', {
      state: 'done',
      detail: `${evaluation.datasetSize} crop profiles scored · ${evaluation.recommended.length} recommended, ${evaluation.conditional.length} conditional, ${evaluation.rejected.length} rejected${unavailableInputs.length ? ` · rules evaluated with missing ${unavailableInputs.join(', ')} signals` : ''}`,
      source: `${DATA_SOURCES.rulesEngine.label} v${evaluation.engineVersion}`,
      finishedAt: Date.now(),
    });
  } catch (error) {
    outcome.evaluation.error = describeError(error);
    onStage('suitability', {
      state: 'error',
      detail: outcome.evaluation.error,
      finishedAt: Date.now(),
    });
  }

  /* ------------------------------------------------------------------- 7. crops */
  onStage('crops', { state: 'active', startedAt: Date.now() });
  if (!evaluation) {
    onStage('crops', {
      state: 'unavailable',
      detail: 'Crop allocation requires a completed rules-engine evaluation.',
      finishedAt: Date.now(),
    });
  } else {
    try {
      const chosen = chooseAllocations(evaluation);
      const shares = allocationShares(chosen);
      const zones = buildCropZones(
        field,
        chosen.map((c, index) => ({ id: `zone-${index}`, evaluation: c, share: shares[index] })),
        ZONE_COLORS,
      );
      const rotation = buildRotation([...evaluation.recommended, ...evaluation.conditional], ZONE_COLORS);
      const supply = outcome.climate.value ? waterBalanceMm(outcome.climate.value) : null;
      const guardrails = validatePlan({
        evaluation,
        zones,
        rotation,
        waterSupplyMm:
          outcome.climate.value?.annualRainfallMm !== null && outcome.climate.value?.annualRainfallMm !== undefined
            ? outcome.climate.value.annualRainfallMm
            : null,
      });
      const aiPlan = await requestAiExplanation(evaluation, zones, rotation, signal);
      const planning: PlanningResult = {
        zones,
        rotation,
        aiPlan: { ...aiPlan, guardrails, guardrailsPassed: guardrails.every((c) => c.passed) },
        projectedWaterReductionPct: null,
        projectedRevenueDeltaPct: null,
        recommendations: rulesDerivedRecommendations(evaluation, zones, rotation),
        isSample: false,
      };
      outcome.planning.value = planning;
      const passed = guardrails.filter((c) => c.passed).length;
      onStage('crops', {
        state: 'done',
        detail: `${zones.length} crop zone${zones.length === 1 ? '' : 's'} allocated · ${rotation.length} rotation slots · guardrails ${passed}/${guardrails.length} passed${aiPlan.status === 'unavailable' ? ' · AI explanation unavailable' : ''}`,
        source: DATA_SOURCES.rulesEngine.label,
        finishedAt: Date.now(),
      });
      void supply;
    } catch (error) {
      outcome.planning.error = describeError(error);
      onStage('crops', {
        state: 'error',
        detail: outcome.planning.error,
        finishedAt: Date.now(),
      });
    }
  }

  return outcome;
}
