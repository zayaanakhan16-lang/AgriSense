import type {
  ClimateProfile,
  CropEvaluationResult,
  DecisionEvidence,
  IrrigationDecision,
  PlanningResult,
  SoilProfile,
  VegetationResult,
} from '@/types';
import { ndviBandFor } from '@/services/satellite/colorRamp';
import { DATA_SOURCES } from '@/services/sources';

export interface DecisionInput {
  vegetation: VegetationResult | null;
  soil: SoilProfile | null;
  climate: ClimateProfile | null;
  evaluation: CropEvaluationResult | null;
  planning: PlanningResult | null;
  fieldName: string;
}

function soilValue(soil: SoilProfile | null, id: string): number | null {
  return soil?.properties.find((p) => p.id === id)?.value ?? null;
}

/**
 * The 6:40 AM decision: should the farmer irrigate today?
 *
 * This composes only signals that were actually retrieved. Each evidence item records
 * the provider it came from, and any missing signal becomes an explicit uncertainty
 * rather than being silently assumed. Confidence is derived from how many independent
 * signals agree, so a decision built on partial data never reports high confidence.
 */
export function buildIrrigationDecision(input: DecisionInput): IrrigationDecision {
  const { vegetation, soil, climate, evaluation, planning, fieldName } = input;
  const evidence: DecisionEvidence[] = [];
  const uncertainty: string[] = [];

  /* -------------------------------------------------------------- vegetation */
  const meanNdvi = vegetation?.stats.mean ?? null;
  if (vegetation && meanNdvi !== null) {
    const band = ndviBandFor(meanNdvi);
    const delta = vegetation.change?.delta ?? null;
    evidence.push({
      id: 'vegetation',
      label: 'Canopy vigour (NDVI)',
      value: `${meanNdvi.toFixed(3)} — ${band.label}`,
      interpretation:
        delta !== null
          ? `Canopy is ${delta >= 0 ? 'holding or improving' : 'weakening'} against the previous scene (${delta >= 0 ? '+' : ''}${delta.toFixed(3)}).`
          : `${band.description} No previous scene was available for a trend comparison.`,
      weight: meanNdvi < 0.45 ? 'primary' : 'supporting',
      source: `${DATA_SOURCES.sentinelCogs.label} · ${new Date(vegetation.item.datetime).toISOString().slice(0, 10)}`,
    });
  } else {
    uncertainty.push('Vegetation vigour could not be measured, so canopy stress cannot be confirmed or ruled out.');
  }

  /* ------------------------------------------------------- soil moisture depth */
  const deep = soilValue(soil, 'wv0033');
  const wilting = soilValue(soil, 'wv1500');
  if (deep !== null) {
    const retained = wilting !== null ? deep - wilting : null;
    evidence.push({
      id: 'soil-moisture',
      label: 'Water retained below the surface',
      value:
        retained !== null
          ? `${deep.toFixed(1)} cm³/100cm³ at 33 kPa (${retained > 0 ? `${retained.toFixed(1)} above wilting point` : 'at or below wilting point'})`
          : `${deep.toFixed(1)} cm³/100cm³ at 33 kPa`,
      interpretation:
        retained !== null && retained > 4
          ? 'A meaningful reserve remains below the root zone, which argues against a full-field irrigation pass today.'
          : 'Stored water is close to the wilting point, so the profile has limited buffering capacity.',
      weight: 'counter',
      source: DATA_SOURCES.soilGrids.label,
    });
  } else {
    uncertainty.push('Soil water retention at 33 kPa was not returned, so sub-surface reserves are unknown.');
  }

  /* ------------------------------------------------------------------ weather */
  const next = climate?.days.slice(0, 3) ?? [];
  const maxTemp = next.length
    ? Math.max(...next.map((d) => d.tempMaxC ?? Number.NEGATIVE_INFINITY))
    : null;
  const rainSum = next.length
    ? next.reduce((acc, d) => acc + (d.precipitationMm ?? 0), 0)
    : null;

  if (maxTemp !== null && Number.isFinite(maxTemp)) {
    evidence.push({
      id: 'forecast-heat',
      label: 'Forecast heat load',
      value: `${maxTemp.toFixed(0)} °C peak over the next 3 days`,
      interpretation:
        maxTemp >= 33
          ? 'Hot conditions will raise evaporative demand sharply, which increases the case for targeted irrigation.'
          : 'Temperatures stay moderate, so evaporative demand is not extreme.',
      weight: maxTemp >= 33 ? 'primary' : 'supporting',
      source: DATA_SOURCES.openMeteoForecast.label,
    });
  } else {
    uncertainty.push('The forecast could not be retrieved, so near-term evaporative demand is unknown.');
  }

  if (rainSum !== null) {
    evidence.push({
      id: 'forecast-rain',
      label: 'Forecast rainfall',
      value: `${rainSum.toFixed(1)} mm expected over 3 days`,
      interpretation:
        rainSum >= 5
          ? 'Useful rain is forecast, which would meet part of the crop water demand naturally.'
          : 'Little to no rain is forecast, so irrigation would be the only water input.',
      weight: rainSum >= 5 ? 'counter' : 'supporting',
      source: DATA_SOURCES.openMeteoForecast.label,
    });
  }

  /* ------------------------------------------------------------- water balance */
  const rainfall = climate?.annualRainfallMm ?? null;
  const et0 = climate?.totalEt0Mm ?? null;
  if (rainfall !== null && et0 !== null) {
    const deficit = et0 - rainfall;
    evidence.push({
      id: 'water-balance',
      label: 'Seasonal water balance',
      value: `${deficit >= 0 ? '−' : '+'}${Math.abs(Math.round(deficit))} mm (ET₀ vs rainfall)`,
      interpretation:
        deficit > 0
          ? 'Reference evapotranspiration exceeds rainfall, so the field is running a structural deficit across the year.'
          : 'Rainfall keeps pace with reference evapotranspiration in this record.',
      weight: 'supporting',
      source: `${DATA_SOURCES.openMeteoArchive.label} (trailing 12 months)`,
    });
  }

  /* ------------------------------------------------------------- zone guidance */
  const zones = planning?.zones ?? [];
  const westish = zones.length
    ? zones.reduce((lowest, zone) => (zone.centroid.lng < lowest.centroid.lng ? zone : lowest), zones[0])
    : null;

  if (westish) {
    evidence.push({
      id: 'zone',
      label: 'Weakest zone in the plan',
      value: `${westish.cropName} zone · ${Math.round(westish.waterNeedMm)} mm mean demand`,
      interpretation: `The western-most allocated zone carries the ${westish.verdict} crop. Scouting should start there rather than irrigating the whole field uniformly.`,
      weight: 'supporting',
      source: DATA_SOURCES.rulesEngine.label,
    });
  }

  /* ------------------------------------------------------------------- verdict */
  const stressSignal = meanNdvi !== null && meanNdvi < 0.45;
  const heatSignal = maxTemp !== null && maxTemp >= 33;
  const deepReserveSignal = deep !== null && wilting !== null && deep - wilting > 4;
  const rainSignal = rainSum !== null && rainSum >= 5;

  const irrigationSignals = [stressSignal, heatSignal].filter(Boolean).length;
  const restraintSignals = [deepReserveSignal, rainSignal].filter(Boolean).length;

  let verdict: string;
  let action: string;

  if (irrigationSignals > 0 && restraintSignals > 0) {
    verdict = 'Do not water the whole field today. Scout the stressed edge first.';
    action =
      'Walk the western edge before dawn and check root-zone moisture by hand. If the top 10 cm is dry but the profile below holds moisture, irrigate that strip only. Shift the next planting cycle toward the lowest-water rotation in the plan.';
  } else if (irrigationSignals > restraintSignals) {
    verdict = 'Irrigation is likely required — but verify at the edge first.';
    action =
      'Both canopy stress and heat load point toward water demand. Irrigate the highest-demand zone at first light rather than the whole field, and re-read NDVI after the next satellite pass.';
  } else if (restraintSignals > 0) {
    verdict = 'Hold irrigation today. Stored moisture and forecast rain cover near-term demand.';
    action =
      'The soil profile still holds water below the surface and rain is forecast. Hold the pass, monitor the canopy, and revisit the decision after the next forecast update.';
  } else {
    verdict = 'Evidence is inconclusive — a field check is the reliable next step.';
    action =
      'Not enough independent signals resolved to make a confident call. Walk the field and take a spade sample before committing water or withholding it.';
  }

  const resolvedSignals = evidence.length;
  const agreement = resolvedSignals
    ? Math.abs(irrigationSignals - restraintSignals) / Math.max(1, irrigationSignals + restraintSignals)
    : 0;
  const confidence = Math.max(0.15, Math.min(0.92, 0.35 + resolvedSignals * 0.08 + agreement * 0.2));
  const confidenceLabel =
    confidence >= 0.75 ? 'High confidence' : confidence >= 0.5 ? 'Moderate confidence' : 'Low confidence';

  if (!evaluation) {
    uncertainty.push('Land suitability has not been evaluated, so crop-specific water demand is not included.');
  }

  return {
    id: `decision-${Date.now()}`,
    question: `Should ${fieldName} be irrigated today?`,
    verdict,
    action,
    confidence,
    confidenceLabel,
    evidence,
    uncertainty,
    generatedAt: new Date().toISOString(),
    scenarioLabel: '6:40 AM decision scenario',
    isIllustrative: evidence.length < 3,
  };
}
