import type {
  AiPlan,
  AiPlanNarrative,
  CropEvaluation,
  CropEvaluationResult,
  CropZone,
  Field,
  GuardrailCheck,
  LngLat,
  RotationSlot,
} from '@/types';
import { polygonAreaM2 } from '@/lib/geo';
import { CROP_DATASET_META } from '@/data/cropProfiles';

/* -------------------------------------------------------------------------- */
/* Spatial partition: split a field polygon into proportional crop zones      */
/* -------------------------------------------------------------------------- */

type Point2D = [number, number];

const METRES_PER_DEG_LAT = 110574;

function localMetresPerDegree(lat: number): { x: number; y: number } {
  return {
    x: (Math.PI / 180) * 6378137 * Math.cos((lat * Math.PI) / 180),
    y: METRES_PER_DEG_LAT,
  };
}

function toLocal(ring: LngLat[], origin: LngLat): Point2D[] {
  const scale = localMetresPerDegree(origin.lat);
  return ring.map((c) => [(c.lng - origin.lng) * scale.x, (c.lat - origin.lat) * scale.y]);
}

function toLngLat(ring: Point2D[], origin: LngLat): LngLat[] {
  const scale = localMetresPerDegree(origin.lat);
  return ring.map(([x, y]) => ({ lng: origin.lng + x / scale.x, lat: origin.lat + y / scale.y }));
}

/** Sutherland–Hodgman clip of a convex-ish polygon against an axis-aligned half-plane. */
function clipHalfPlane(ring: Point2D[], axis: 0 | 1, value: number, keepGreater: boolean): Point2D[] {
  const inside = (p: Point2D): boolean => (keepGreater ? p[axis] >= value : p[axis] <= value);
  const output: Point2D[] = [];
  for (let i = 0; i < ring.length; i += 1) {
    const current = ring[i];
    const previous = ring[(i - 1 + ring.length) % ring.length];
    const currentInside = inside(current);
    const previousInside = inside(previous);
    if (currentInside !== previousInside) {
      const t = (value - previous[axis]) / (current[axis] - previous[axis] || 1);
      output.push([
        previous[0] + (current[0] - previous[0]) * t,
        previous[1] + (current[1] - previous[1]) * t,
      ]);
    }
    if (currentInside) output.push(current);
  }
  return output;
}

interface Allocation {
  id: string;
  evaluation: CropEvaluation;
  share: number;
}

/**
 * Slice the drawn boundary into proportional zones along its dominant axis.
 * Shares are converted into parallel strips, then each strip is clipped to the
 * original polygon so zones always tile the field exactly.
 */
export function buildCropZones(field: Field, allocations: Allocation[], colors: string[]): CropZone[] {
  const ring = field.boundary.coords;
  if (ring.length < 3 || !allocations.length) return [];

  const origin = field.boundary.centroid;
  const local = toLocal(ring, origin);

  const xs = local.map((p) => p[0]);
  const ys = local.map((p) => p[1]);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  const axis: 0 | 1 = spanX >= spanY ? 0 : 1;

  const min = axis === 0 ? Math.min(...xs) : Math.min(...ys);
  const max = axis === 0 ? Math.max(...xs) : Math.max(...ys);

  const totalShare = allocations.reduce((acc, a) => acc + a.share, 0) || 1;
  const cumulative: number[] = [];
  let running = 0;
  for (const allocation of allocations) {
    running += allocation.share / totalShare;
    cumulative.push(running);
  }

  const zones: CropZone[] = [];
  let lowerBound = min;

  allocations.forEach((allocation, index) => {
    const upperBound = index === allocations.length - 1 ? max : min + (max - min) * cumulative[index];
    const color = colors[index % colors.length];

    let clipped = clipHalfPlane(local, axis, lowerBound, true);
    if (clipped.length >= 3) clipped = clipHalfPlane(clipped, axis, upperBound, false);

    const coords = clipped.length >= 3 ? toLngLat(clipped, origin) : [];
    const areaM2 = coords.length >= 3 ? polygonAreaM2(coords) : field.boundary.areaM2 * (allocation.share / totalShare);

    // Centroid of the zone, computed in local metres then converted back.
    const centroidLocal: Point2D = clipped.length
      ? [
          clipped.reduce((acc, p) => acc + p[0], 0) / clipped.length,
          clipped.reduce((acc, p) => acc + p[1], 0) / clipped.length,
        ]
      : [0, 0];
    const centroid = toLngLat([centroidLocal], origin)[0];

    zones.push({
      id: allocation.id,
      cropId: allocation.evaluation.crop.id,
      cropName: allocation.evaluation.crop.name,
      color,
      share: allocation.share / totalShare,
      areaM2,
      waterNeedMm: (allocation.evaluation.crop.waterRequirementMm.min + allocation.evaluation.crop.waterRequirementMm.max) / 2,
      rationale: allocation.evaluation.rationale,
      coords,
      centroid,
      verdict: allocation.evaluation.verdict,
    });

    lowerBound = upperBound;
  });

  return zones;
}

/* -------------------------------------------------------------------------- */
/* Rotation calendar                                                          */
/* -------------------------------------------------------------------------- */

const SEASONS: Array<{ id: RotationSlot['season']; label: string; months: number[] }> = [
  { id: 'spring', label: 'Spring', months: [2, 3, 4] },
  { id: 'summer', label: 'Summer / Kharif', months: [5, 6, 7, 8] },
  { id: 'autumn-winter', label: 'Autumn–winter / Rabi', months: [9, 10, 11, 0, 1] },
];

export function buildRotation(
  candidates: CropEvaluation[],
  colors: string[],
): RotationSlot[] {
  const slots: RotationSlot[] = [];
  const used = new Set<string>();

  for (const season of SEASONS) {
    // Prefer the highest-scoring candidate that plants in this season and has not been used.
    const fresh = candidates.find(
      (candidate) =>
        !used.has(candidate.crop.id) &&
        candidate.crop.plantingMonths.some((m) => season.months.includes(m)),
    );
    const chosen =
      fresh ??
      candidates.find((candidate) => candidate.crop.plantingMonths.some((m) => season.months.includes(m)));

    if (!chosen) continue;
    used.add(chosen.crop.id);
    const color = colors[slots.length % colors.length];
    slots.push({
      season: season.id,
      months: season.months,
      cropId: chosen.crop.id,
      cropName: chosen.crop.name,
      color,
      waterMm: (chosen.crop.waterRequirementMm.min + chosen.crop.waterRequirementMm.max) / 2,
      note: `${chosen.crop.cycleDays}-day cycle. ${chosen.rationale}`,
    });
  }

  return slots;
}

/* -------------------------------------------------------------------------- */
/* Guardrail validation                                                       */
/* -------------------------------------------------------------------------- */

export interface GuardrailInput {
  evaluation: CropEvaluationResult;
  zones: CropZone[];
  rotation: RotationSlot[];
  waterSupplyMm: number | null;
}

/**
 * Deterministic guardrails. These verify that a plan derived from the rules engine is
 * internally consistent and physically supportable before it is ever presented.
 */
export function validatePlan(input: GuardrailInput): GuardrailCheck[] {
  const { evaluation, zones, rotation, waterSupplyMm } = input;
  const approvedIds = new Set(
    [...evaluation.recommended, ...evaluation.conditional].map((e) => e.crop.id),
  );
  const checks: GuardrailCheck[] = [];

  const unapproved = zones.filter((zone) => !approvedIds.has(zone.cropId));
  checks.push({
    id: 'rules-provenance',
    label: 'Every zone crop passed the rules engine',
    passed: unapproved.length === 0,
    detail:
      unapproved.length === 0
        ? `All ${zones.length} zone crops are rule-approved candidates.`
        : `${unapproved.map((z) => z.cropName).join(', ')} were not approved by the rules engine.`,
  });

  const shareSum = zones.reduce((acc, zone) => acc + zone.share, 0);
  checks.push({
    id: 'area-conservation',
    label: 'Zone shares tile the field exactly',
    passed: Math.abs(shareSum - 1) < 0.001,
    detail: `Zone shares sum to ${(shareSum * 100).toFixed(1)}% of the drawn boundary.`,
  });

  const zoneArea = zones.reduce((acc, zone) => acc + zone.areaM2, 0);
  const areaDelta = Math.abs(zoneArea - evaluation.fieldContext.areaM2) / Math.max(1, evaluation.fieldContext.areaM2);
  checks.push({
    id: 'area-accuracy',
    label: 'Allocated area matches the drawn boundary',
    passed: areaDelta < 0.12,
    detail: `Allocated ${Math.round(zoneArea / 10000 * 100) / 100} ha against a drawn ${Math.round(evaluation.fieldContext.areaM2 / 10000 * 100) / 100} ha (${(areaDelta * 100).toFixed(1)}% difference).`,
  });

  const rotationIds = rotation.map((slot) => slot.cropId);
  const consecutiveRepeat = rotationIds.some((id, index) => index > 0 && rotationIds[index - 1] === id);
  checks.push({
    id: 'rotation-diversity',
    label: 'No crop repeats in consecutive seasons',
    passed: !consecutiveRepeat && rotationIds.length === new Set(rotationIds).size,
    detail:
      rotationIds.length === 0
        ? 'No rotation slots were generated for this field.'
        : consecutiveRepeat
          ? 'A crop repeats across consecutive seasons, which breaks the rotation rule.'
          : `${rotationIds.length} distinct crops sequenced across the year.`,
  });

  const waterDemand = zones.reduce((acc, zone) => acc + zone.waterNeedMm * zone.share, 0);
  const waterKnown = waterSupplyMm !== null;
  checks.push({
    id: 'water-budget',
    label: 'Weighted water demand within local supply',
    passed: !waterKnown ? true : waterDemand <= waterSupplyMm * 1.35,
    detail: !waterKnown
      ? 'Rainfall history unavailable, so the water budget could not be verified.'
      : `Weighted demand of ${Math.round(waterDemand)} mm against an effective supply of ${Math.round(waterSupplyMm)} mm.`,
  });

  const datasetLabelled = CROP_DATASET_META.isDemonstration;
  checks.push({
    id: 'data-provenance',
    label: 'Data provenance is disclosed',
    passed: true,
    detail: datasetLabelled
      ? 'Crop profiles come from the labelled demonstration dataset, not a connected rules-engine service.'
      : 'Crop profiles loaded from the connected rules-engine service.',
  });

  return checks;
}

/* -------------------------------------------------------------------------- */
/* AI explanation adapter (never selects crops)                               */
/* -------------------------------------------------------------------------- */

const API_BASE = import.meta.env.VITE_AGRISENSE_API_URL?.replace(/\/$/, '') ?? '';

export const AI_ADAPTER_CONFIG = {
  configured: Boolean(API_BASE),
  provider: 'Gemini',
  model: 'gemini-2.0-flash',
  endpoint: API_BASE ? `${API_BASE}/explain-plan` : null,
} as const;

interface ExplainResponse {
  headline?: string;
  summary?: string;
  reasoning?: string[];
  cautions?: string[];
}

/**
 * Request a natural-language explanation of an already rule-approved plan.
 *
 * The request body contains only approved candidates plus the deterministic scores that
 * produced them, so the model explains the rules engine rather than replacing it. When no
 * API base URL is configured this returns an honest unavailable state — no narrative is
 * ever fabricated.
 */
export async function requestAiExplanation(
  evaluation: CropEvaluationResult,
  zones: CropZone[],
  rotation: RotationSlot[],
  signal?: AbortSignal,
): Promise<AiPlan> {
  const approved = [...evaluation.recommended, ...evaluation.conditional];

  if (!AI_ADAPTER_CONFIG.configured || !AI_ADAPTER_CONFIG.endpoint) {
    return {
      status: 'unavailable',
      provider: AI_ADAPTER_CONFIG.provider,
      model: AI_ADAPTER_CONFIG.model,
      narrative: null,
      guardrails: [],
      guardrailsPassed: false,
      message:
        'No AI explanation service is connected. The crop plan above was produced entirely by the deterministic rules engine. Configure VITE_AGRISENSE_API_URL to enable explanations.',
    };
  }

  try {
    const response = await fetch(AI_ADAPTER_CONFIG.endpoint, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'explain_approved_plan',
        constraints: {
          mustNotIntroduceCrops: true,
          approvedCropIds: approved.map((e) => e.crop.id),
        },
        fieldContext: evaluation.fieldContext,
        approvedCandidates: approved.map((e) => ({
          cropId: e.crop.id,
          cropName: e.crop.name,
          score: Number(e.score.toFixed(3)),
          verdict: e.verdict,
          factors: e.factors.map((f) => ({ id: f.id, score: Number(f.score.toFixed(3)), detail: f.detail })),
          constraints: e.constraints,
        })),
        rejectedCandidates: evaluation.rejected.slice(0, 20).map((e) => ({
          cropId: e.crop.id,
          cropName: e.crop.name,
          score: Number(e.score.toFixed(3)),
          constraints: e.constraints,
        })),
        zones: zones.map((z) => ({ cropId: z.cropId, cropName: z.cropName, share: Number(z.share.toFixed(3)) })),
        rotation: rotation.map((r) => ({ season: r.season, cropId: r.cropId, cropName: r.cropName })),
      }),
    });

    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const payload = (await response.json()) as ExplainResponse;
    const narrative: AiPlanNarrative = {
      headline: payload.headline ?? 'Plan explanation',
      summary: payload.summary ?? '',
      reasoning: payload.reasoning ?? [],
      cautions: payload.cautions ?? [],
    };
    if (!narrative.summary && !narrative.reasoning.length) throw new Error('Empty explanation payload');

    return {
      status: 'ok',
      provider: AI_ADAPTER_CONFIG.provider,
      model: AI_ADAPTER_CONFIG.model,
      narrative,
      guardrails: [],
      guardrailsPassed: false,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      provider: AI_ADAPTER_CONFIG.provider,
      model: AI_ADAPTER_CONFIG.model,
      narrative: null,
      guardrails: [],
      guardrailsPassed: false,
      message: `The AI explanation service could not be reached (${
        error instanceof Error ? error.message : 'unknown error'
      }). The crop plan remains fully rules-engine derived.`,
    };
  }
}

/** Deterministic, rules-derived recommendation text. Never AI-generated. */
export function rulesDerivedRecommendations(
  evaluation: CropEvaluationResult,
  zones: CropZone[],
  rotation: RotationSlot[],
): string[] {
  const recommendations: string[] = [];
  const top = evaluation.recommended[0] ?? evaluation.conditional[0];

  if (top) {
    recommendations.push(
      `Prioritise ${top.crop.name} — highest rules-engine score at ${Math.round(top.score * 100)}/100. ${top.factors.find((f) => f.id === 'water')?.detail ?? ''}`.trim(),
    );
  }

  const water = evaluation.fieldContext;
  if (water.waterBalanceMm !== null && water.waterBalanceMm < 0) {
    recommendations.push(
      `The field runs a ${Math.round(Math.abs(water.waterBalanceMm))} mm annual water deficit against reference evapotranspiration. Plan irrigation around the deficit rather than a fixed calendar.`,
    );
  } else if (water.annualRainfallMm !== null) {
    recommendations.push(
      `Annual rainfall of ${Math.round(water.annualRainfallMm)} mm covers the highest-scoring crops without supplemental irrigation in an average year.`,
    );
  }

  if (zones.length > 1) {
    const highestWater = [...zones].sort((a, b) => b.waterNeedMm - a.waterNeedMm)[0];
    const lowestWater = [...zones].sort((a, b) => a.waterNeedMm - b.waterNeedMm)[0];
    recommendations.push(
      `Concentrate irrigation on the ${highestWater.cropName} zone (${Math.round(highestWater.waterNeedMm)} mm mean demand) and let the ${lowestWater.cropName} zone draw on stored soil moisture.`,
    );
  }

  if (rotation.length >= 2) {
    recommendations.push(
      `Follow the ${rotation.map((r) => r.cropName).join(' → ')} sequence to break pest and disease cycles and spread water demand across the year.`,
    );
  }

  const rejected = evaluation.rejected.slice(0, 2);
  if (rejected.length) {
    recommendations.push(
      `${rejected.map((r) => r.crop.name).join(' and ')} were rejected by the rules engine. Review the rejected-crop panel before overriding.`,
    );
  }

  if (water.meanNdvi !== null && water.meanNdvi < 0.35) {
    recommendations.push(
      `Mean NDVI of ${water.meanNdvi.toFixed(2)} indicates weak canopy cover. Ground-truth the field before committing to a high-input crop.`,
    );
  }

  return recommendations;
}
