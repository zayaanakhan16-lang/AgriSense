import type {
  ClimateProfile,
  CropEvaluation,
  CropEvaluationResult,
  CropProfile,
  Field,
  RulesFieldContext,
  SoilProfile,
  SuitabilityFactor,
  SuitabilityVerdict,
  VegetationResult,
} from '@/types';
import { CROP_DATASET_META, CROP_PROFILES, WATER_CLASS_LABELS } from '@/data/cropProfiles';
import { waterBalanceMm } from '@/services/climate';
import { areaInHectares } from '@/lib/format';

export const RULES_ENGINE_META = {
  id: 'agrisense-rules-engine',
  version: '1.4.0',
  description:
    'Deterministic agronomic rule evaluation. Every crop is scored against water, soil, climate and seasonal rules before any language model is involved.',
} as const;

/** Factor weights — fixed and published so results are reproducible and auditable. */
export const FACTOR_WEIGHTS = {
  water: 0.28,
  climate: 0.24,
  season: 0.2,
  ph: 0.16,
  texture: 0.12,
} as const;

export const VERDICT_THRESHOLDS = {
  recommended: 0.72,
  conditional: 0.5,
} as const;

export interface RulesEngineInput {
  field: Field;
  vegetation?: VegetationResult | null;
  soil?: SoilProfile | null;
  climate?: ClimateProfile | null;
  /** Month index (0–11) used for seasonal suitability. Defaults to the current month. */
  referenceMonth?: number;
}

export function buildFieldContext(input: RulesEngineInput): RulesFieldContext {
  const { field, vegetation, soil, climate } = input;
  const ph = soil?.properties.find((p) => p.id === 'phh2o')?.value ?? null;
  const soc = soil?.properties.find((p) => p.id === 'soc')?.value ?? null;
  const clay = soil?.properties.find((p) => p.id === 'clay')?.value ?? null;
  const sand = soil?.properties.find((p) => p.id === 'sand')?.value ?? null;

  return {
    areaM2: field.boundary.areaM2,
    meanNdvi: vegetation?.stats.mean ?? null,
    soilPh: ph,
    organicCarbon: soc,
    clayFraction: clay,
    sandFraction: sand,
    annualRainfallMm: climate?.annualRainfallMm ?? null,
    et0Mm: climate?.totalEt0Mm ?? null,
    tempMinC: climate?.tempRange.minC ?? null,
    tempMaxC: climate?.tempRange.maxC ?? null,
    textureLabel: soil?.texture?.label ?? field.soilTexture ?? null,
    waterBalanceMm: climate ? waterBalanceMm(climate) : null,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function verdictFor(score: number): SuitabilityVerdict {
  if (score >= VERDICT_THRESHOLDS.recommended) return 'recommended';
  if (score >= VERDICT_THRESHOLDS.conditional) return 'conditional';
  return 'rejected';
}

interface FactorOutcome {
  factor: SuitabilityFactor;
  constraint?: string;
}

function evaluateWater(crop: CropProfile, ctx: RulesFieldContext): FactorOutcome {
  const needMin = crop.waterRequirementMm.min;
  const needMax = crop.waterRequirementMm.max;
  const needMean = (needMin + needMax) / 2;

  // Effective water supply = growing-season rainfall plus any modelled surplus.
  const rainfall = ctx.annualRainfallMm;
  if (rainfall === null) {
    return {
      factor: {
        id: 'water',
        label: 'Water requirement',
        score: 0.6,
        weight: FACTOR_WEIGHTS.water,
        detail: `${WATER_CLASS_LABELS[crop.waterClass]} demand (${needMin}–${needMax} mm). Rainfall data unavailable, so irrigation need could not be quantified.`,
        verdict: 'marginal',
      },
      constraint: 'Rainfall history unavailable — irrigation requirement not verified.',
    };
  }

  const surplus = ctx.waterBalanceMm !== null && ctx.waterBalanceMm > 0 ? ctx.waterBalanceMm : 0;
  const supply = rainfall + surplus * 0.5;
  const deficit = needMean - supply;

  let score: number;
  let verdict: SuitabilityFactor['verdict'];
  if (deficit <= 0) {
    score = 1;
    verdict = 'pass';
  } else if (deficit <= 250) {
    score = 1 - (deficit / 250) * 0.35;
    verdict = 'marginal';
  } else {
    score = clamp01(1 - deficit / 900);
    verdict = deficit > 450 ? 'fail' : 'marginal';
  }

  // Crops whose demand is far above the local supply are penalised more steeply.
  if (crop.waterClass === 'very-high' && deficit > 0) score = clamp01(score - 0.18);
  if (crop.waterClass === 'very-low' && deficit <= 0) score = clamp01(score + 0.02);

  const detail =
    deficit <= 0
      ? `Rainfall of ${Math.round(rainfall)} mm covers the ${Math.round(needMean)} mm mean demand, leaving a ${Math.round(-deficit)} mm surplus.`
      : `Mean demand of ${Math.round(needMean)} mm exceeds the ${Math.round(supply)} mm effective supply by ${Math.round(deficit)} mm — irrigation would be required.`;

  return {
    factor: {
      id: 'water',
      label: 'Water requirement',
      score,
      weight: FACTOR_WEIGHTS.water,
      detail,
      verdict,
    },
    constraint:
      deficit > 450
        ? `Irrigation deficit of ${Math.round(deficit)} mm is not supportable without a confirmed water source.`
        : undefined,
  };
}

function evaluatePh(crop: CropProfile, ctx: RulesFieldContext): FactorOutcome {
  const ph = ctx.soilPh;
  if (ph === null) {
    return {
      factor: {
        id: 'ph',
        label: 'Soil pH fit',
        score: 0.6,
        weight: FACTOR_WEIGHTS.ph,
        detail: `Optimal pH ${crop.optimalPh[0]}–${crop.optimalPh[1]}. Soil pH unavailable, so this rule was not evaluated.`,
        verdict: 'marginal',
      },
      constraint: 'Soil pH unavailable — nutrient availability not verified.',
    };
  }

  const [optMin, optMax] = crop.optimalPh;
  const [tolMin, tolMax] = crop.toleratedPh;
  let score: number;
  let verdict: SuitabilityFactor['verdict'];
  if (ph >= optMin && ph <= optMax) {
    score = 1;
    verdict = 'pass';
  } else if (ph >= tolMin && ph <= tolMax) {
    const distance = ph < optMin ? optMin - ph : ph - optMax;
    const span = ph < optMin ? optMin - tolMin : tolMax - optMax;
    score = clamp01(0.62 - (span > 0 ? (distance / span) * 0.18 : 0));
    verdict = 'marginal';
  } else {
    score = 0.12;
    verdict = 'fail';
  }

  return {
    factor: {
      id: 'ph',
      label: 'Soil pH fit',
      score,
      weight: FACTOR_WEIGHTS.ph,
      detail: `Measured pH ${ph.toFixed(1)} against an optimal range of ${optMin}–${optMax} (tolerated ${tolMin}–${tolMax}).`,
      verdict,
    },
    constraint: verdict === 'fail' ? `Soil pH ${ph.toFixed(1)} is outside the tolerated range for ${crop.name}.` : undefined,
  };
}

function evaluateTexture(crop: CropProfile, ctx: RulesFieldContext): FactorOutcome {
  const texture = ctx.textureLabel;
  if (!texture) {
    return {
      factor: {
        id: 'texture',
        label: 'Soil texture match',
        score: 0.6,
        weight: FACTOR_WEIGHTS.texture,
        detail: `Suited to ${crop.soilTextures.join(', ')}. Texture class unavailable, so this rule was not evaluated.`,
        verdict: 'marginal',
      },
      constraint: 'Soil texture unavailable — root-zone suitability not verified.',
    };
  }

  const match = crop.soilTextures.some((t) => t.toLowerCase() === texture.toLowerCase());
  const score = match ? 1 : 0.55;
  return {
    factor: {
      id: 'texture',
      label: 'Soil texture match',
      score,
      weight: FACTOR_WEIGHTS.texture,
      detail: match
        ? `${texture} is a listed suitable texture for ${crop.name}.`
        : `${texture} is not a preferred texture; ${crop.name} performs best on ${crop.soilTextures.join(', ')}.`,
      verdict: match ? 'pass' : 'marginal',
    },
    constraint: match ? undefined : `Texture ${texture} is outside the preferred set for ${crop.name}.`,
  };
}

function evaluateClimate(crop: CropProfile, ctx: RulesFieldContext): FactorOutcome {
  const tMin = ctx.tempMinC;
  const tMax = ctx.tempMaxC;
  if (tMin === null || tMax === null) {
    return {
      factor: {
        id: 'climate',
        label: 'Climate compatibility',
        score: 0.6,
        weight: FACTOR_WEIGHTS.climate,
        detail: `Optimal growing temperature ${crop.optimalTempC[0]}–${crop.optimalTempC[1]} °C. Temperature history unavailable.`,
        verdict: 'marginal',
      },
      constraint: 'Temperature history unavailable — climate fit not verified.',
    };
  }

  const [absMin, absMax] = crop.absoluteTempC;
  const frostRisk = tMin < absMin;
  const heatRisk = tMax > absMax;

  // Share of the crop's optimal band that overlaps the observed annual temperature range.
  const overlapLow = Math.max(tMin, crop.optimalTempC[0]);
  const overlapHigh = Math.min(tMax, crop.optimalTempC[1]);
  const optimalSpan = Math.max(1, crop.optimalTempC[1] - crop.optimalTempC[0]);
  const overlapRatio = clamp01((overlapHigh - overlapLow) / optimalSpan);

  let score = 0.35 + overlapRatio * 0.65;
  if (frostRisk) score -= 0.22;
  if (heatRisk) score -= 0.18;
  if (crop.droughtTolerance === 'high' && heatRisk) score += 0.08;
  score = clamp01(score);

  const verdict: SuitabilityFactor['verdict'] = score >= 0.7 ? 'pass' : score >= 0.45 ? 'marginal' : 'fail';
  const notes: string[] = [];
  if (frostRisk) notes.push(`winter minimum of ${tMin.toFixed(0)} °C is below the ${absMin} °C tolerance limit`);
  if (heatRisk) notes.push(`summer maximum of ${tMax.toFixed(0)} °C exceeds the ${absMax} °C tolerance limit`);
  const detail = notes.length
    ? `Observed ${tMin.toFixed(0)}–${tMax.toFixed(0)} °C: ${notes.join('; ')}.`
    : `Observed ${tMin.toFixed(0)}–${tMax.toFixed(0)} °C sits inside the ${crop.optimalTempC[0]}–${crop.optimalTempC[1]} °C optimal band.`;

  const constraints: string[] = [];
  if (frostRisk) constraints.push(`Frost risk: minima below the ${absMin} °C tolerance for ${crop.name}.`);
  if (heatRisk) constraints.push(`Heat risk: maxima above the ${absMax} °C tolerance for ${crop.name}.`);

  return {
    factor: { id: 'climate', label: 'Climate compatibility', score, weight: FACTOR_WEIGHTS.climate, detail, verdict },
    constraint: constraints.join(' ') || undefined,
  };
}

function evaluateSeason(crop: CropProfile, referenceMonth: number): FactorOutcome {
  const month = ((referenceMonth % 12) + 12) % 12;
  const window = [month, (month + 1) % 12, (month + 2) % 12];
  const hits = window.filter((m) => crop.plantingMonths.includes(m)).length;
  const score = hits >= 2 ? 1 : hits === 1 ? 0.78 : 0.34;
  const verdict: SuitabilityFactor['verdict'] = hits >= 1 ? 'pass' : 'fail';
  const monthName = new Date(2000, month, 1).toLocaleString('en-GB', { month: 'long' });

  return {
    factor: {
      id: 'season',
      label: 'Seasonal suitability',
      score,
      weight: FACTOR_WEIGHTS.season,
      detail:
        hits >= 1
          ? `Planting window opens within three months of ${monthName}; typical cycle is ${crop.cycleDays} days.`
          : `${monthName} is outside the typical planting window for ${crop.name}.`,
      verdict,
    },
    constraint: hits === 0 ? `${monthName} falls outside the planting window for ${crop.name}.` : undefined,
  };
}

function buildRationale(factors: SuitabilityFactor[], score: number, verdict: SuitabilityVerdict): string {
  const strongest = [...factors].sort((a, b) => b.score * b.weight - a.score * a.weight)[0];
  const weakest = [...factors].sort((a, b) => a.score * a.weight - b.score * b.weight)[0];
  const pct = Math.round(score * 100);

  if (verdict === 'recommended') {
    return `Scores ${pct}/100. Strongest fit is ${strongest.label.toLowerCase()} (${Math.round(strongest.score * 100)}%). ${weakest.detail}`;
  }
  if (verdict === 'conditional') {
    return `Scores ${pct}/100 — viable with management. Limiting factor is ${weakest.label.toLowerCase()} (${Math.round(weakest.score * 100)}%). ${weakest.detail}`;
  }
  return `Scores ${pct}/100 and falls below the ${Math.round(VERDICT_THRESHOLDS.conditional * 100)}/100 acceptance threshold. Primary blocker is ${weakest.label.toLowerCase()}. ${weakest.detail}`;
}

/**
 * Deterministic evaluation of every crop profile against the field context.
 * This function contains no randomness: the same field context always produces the
 * same ranking, which is what makes the downstream AI explanation auditable.
 */
export function evaluateCrops(input: RulesEngineInput, profiles: CropProfile[] = CROP_PROFILES): CropEvaluationResult {
  const ctx = buildFieldContext(input);
  const referenceMonth = input.referenceMonth ?? new Date().getMonth();

  const evaluations: CropEvaluation[] = profiles.map((crop) => {
    const outcomes = [
      evaluateWater(crop, ctx),
      evaluateClimate(crop, ctx),
      evaluateSeason(crop, referenceMonth),
      evaluatePh(crop, ctx),
      evaluateTexture(crop, ctx),
    ];
    const factors = outcomes.map((o) => o.factor);
    const score = factors.reduce((acc, f) => acc + f.score * f.weight, 0);
    const constraints = outcomes.map((o) => o.constraint).filter((v): v is string => Boolean(v));
    const verdict = verdictFor(score);
    return {
      crop,
      score,
      verdict,
      factors,
      constraints,
      rationale: buildRationale(factors, score, verdict),
    };
  });

  evaluations.sort((a, b) => b.score - a.score);

  return {
    evaluations,
    recommended: evaluations.filter((e) => e.verdict === 'recommended'),
    conditional: evaluations.filter((e) => e.verdict === 'conditional'),
    rejected: evaluations.filter((e) => e.verdict === 'rejected'),
    engineId: RULES_ENGINE_META.id,
    engineVersion: RULES_ENGINE_META.version,
    datasetSize: profiles.length,
    origin: CROP_DATASET_META.isDemonstration ? 'demo' : 'live',
    evaluatedAt: new Date().toISOString(),
    fieldContext: ctx,
  };
}

export function fieldAreaHa(field: Field): number {
  return areaInHectares(field.boundary.areaM2);
}

export { CROP_DATASET_META };
