import { create } from 'zustand';
import type {
  AnalysisStage,
  AnalysisStageId,
  ClimateProfile,
  CropEvaluationResult,
  Field,
  PlanningResult,
  SoilProfile,
  VegetationResult,
} from '@/types';
import type { AnalysisOutcome, StagePatch } from '@/services/analysisRunner';

const STAGE_DEFINITIONS: Array<Pick<AnalysisStage, 'id' | 'label' | 'description'>> = [
  { id: 'boundary', label: 'Field boundary processed', description: 'Validating the drawn polygon and computing geodesic area.' },
  { id: 'imagery', label: 'Satellite imagery requested', description: 'Querying the Sentinel-2 L2A catalogue for the newest low-cloud acquisition.' },
  { id: 'vegetation', label: 'Vegetation signals evaluated', description: 'Reading red and near-infrared bands to derive NDVI across the boundary.' },
  { id: 'soil', label: 'Soil profile retrieved', description: 'Pulling ISRIC SoilGrids properties at the field centroid.' },
  { id: 'climate', label: 'Climate history prepared', description: 'Assembling 12 months of rainfall, temperature, ET₀ and soil moisture.' },
  { id: 'suitability', label: 'Land suitability evaluated', description: 'Scoring every crop profile against water, soil, climate and season rules.' },
  { id: 'crops', label: 'Crop profiles assessed', description: 'Allocating zones, building the rotation calendar and validating guardrails.' },
];

export function createInitialStages(): AnalysisStage[] {
  return STAGE_DEFINITIONS.map((definition) => ({ ...definition, state: 'pending' as const }));
}

interface AnalysisState {
  fieldId: string | null;
  stages: AnalysisStage[];
  running: boolean;
  completed: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  outcome: AnalysisOutcome | null;
  error: string | null;
  begin: (field: Field) => void;
  patchStage: (id: AnalysisStageId, patch: StagePatch) => void;
  finish: (outcome: AnalysisOutcome) => void;
  fail: (message: string) => void;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  fieldId: null,
  stages: createInitialStages(),
  running: false,
  completed: false,
  startedAt: null,
  finishedAt: null,
  outcome: null,
  error: null,

  begin: (field) =>
    set({
      fieldId: field.id,
      stages: createInitialStages(),
      running: true,
      completed: false,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      outcome: null,
      error: null,
    }),

  patchStage: (id, patch) =>
    set((state) => ({
      stages: state.stages.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage)),
    })),

  finish: (outcome) =>
    set({ running: false, completed: true, finishedAt: new Date().toISOString(), outcome }),

  fail: (message) => set({ running: false, completed: false, error: message, finishedAt: new Date().toISOString() }),

  reset: () =>
    set({
      fieldId: null,
      stages: createInitialStages(),
      running: false,
      completed: false,
      startedAt: null,
      finishedAt: null,
      outcome: null,
      error: null,
    }),
}));

export interface FieldIntelligence {
  vegetation: VegetationResult | null;
  soil: SoilProfile | null;
  climate: ClimateProfile | null;
  evaluation: CropEvaluationResult | null;
  planning: PlanningResult | null;
  vegetationError: string | null;
  soilError: string | null;
  climateError: string | null;
}

export function selectIntelligence(state: AnalysisState): FieldIntelligence {
  return {
    vegetation: state.outcome?.vegetation.value ?? null,
    soil: state.outcome?.soil.value ?? null,
    climate: state.outcome?.climate.value ?? null,
    evaluation: state.outcome?.evaluation.value ?? null,
    planning: state.outcome?.planning.value ?? null,
    vegetationError: state.outcome?.vegetation.error ?? null,
    soilError: state.outcome?.soil.error ?? null,
    climateError: state.outcome?.climate.error ?? null,
  };
}

export function stageProgress(stages: AnalysisStage[]): { done: number; total: number; fraction: number } {
  const done = stages.filter((s) => s.state === 'done' || s.state === 'unavailable' || s.state === 'error').length;
  const total = stages.length;
  return { done, total, fraction: total ? done / total : 0 };
}
