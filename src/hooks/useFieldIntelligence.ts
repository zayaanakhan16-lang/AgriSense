import { useCallback, useEffect, useRef } from 'react';
import type { AnalysisStage, AnalysisStageId, Field } from '@/types';
import { runFieldAnalysis } from '@/services/analysisRunner';
import { useAnalysisStore, selectIntelligence, type FieldIntelligence } from '@/store/analysisStore';
import { useFieldsStore } from '@/store/fieldsStore';

export interface UseFieldIntelligenceResult {
  field: Field | null;
  intelligence: FieldIntelligence;
  stages: AnalysisStage[];
  running: boolean;
  completed: boolean;
  error: string | null;
  analysedAt: string | null;
  run: () => void;
}

/**
 * Single source of truth for the active field's intelligence.
 *
 * When a field is selected but has not been analysed in this session, the pipeline
 * runs automatically. Because the result lives in a store keyed by field id, moving
 * between intelligence sections reuses the same soil, climate and vegetation data
 * instead of refetching or drifting out of sync.
 */
export function useFieldIntelligence(options: { autoRun?: boolean } = {}): UseFieldIntelligenceResult {
  const { autoRun = true } = options;
  const selectedFieldId = useFieldsStore((s) => s.selectedFieldId);
  const field = useFieldsStore((s) =>
    s.selectedFieldId ? s.fields.find((f) => f.id === s.selectedFieldId) ?? null : null,
  );
  const updateField = useFieldsStore((s) => s.updateField);

  const analysis = useAnalysisStore();
  const intelligence = selectIntelligence(analysis);

  const inFlightRef = useRef<string | null>(null);

  /**
   * Runs the pipeline without an AbortController. The result is keyed by field id in
   * the analysis store, so a run must survive the component unmounting — navigating
   * between intelligence sections mid-analysis previously cancelled the in-flight
   * Sentinel-2 fetch and surfaced a spurious "request was cancelled" result.
   */
  const execute = useCallback(
    (target: Field) => {
      if (inFlightRef.current === target.id) return;
      inFlightRef.current = target.id;

      analysis.begin(target);
      updateField(target.id, { status: 'analyzing' });

      runFieldAnalysis(target, { onStage: analysis.patchStage })
        .then((outcome) => {
          analysis.finish(outcome);
          updateField(target.id, {
            status: 'ready',
            soilTexture: outcome.soil.value?.texture?.label ?? target.soilTexture,
          });
        })
        .catch((error: unknown) => {
          analysis.fail(error instanceof Error ? error.message : 'The analysis pipeline failed.');
          updateField(target.id, { status: 'error' });
        })
        .finally(() => {
          inFlightRef.current = null;
        });
    },
    // The store exposes stable action references; `analysis` itself is intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateField],
  );

  useEffect(() => {
    if (!autoRun || !field) return;
    const alreadyAnalysed = analysis.fieldId === field.id && (analysis.completed || analysis.running);
    if (alreadyAnalysed) return;
    if (inFlightRef.current === field.id) return;
    execute(field);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, field?.id, field?.createdAt, analysis.fieldId, analysis.completed, analysis.running]);


  const run = useCallback(() => {
    if (field) execute(field);
  }, [field, execute]);

  return {
    field,
    intelligence,
    stages: analysis.stages,
    running: analysis.running && analysis.fieldId === selectedFieldId,
    completed: analysis.completed && analysis.fieldId === selectedFieldId,
    error: analysis.fieldId === selectedFieldId ? analysis.error : null,
    analysedAt: analysis.fieldId === selectedFieldId ? analysis.finishedAt : null,
    run,
  };
}

export function stageStateOf(stages: AnalysisStage[], id: AnalysisStageId): AnalysisStage['state'] {
  return stages.find((stage) => stage.id === id)?.state ?? 'pending';
}

export function stageDetailOf(stages: AnalysisStage[], id: AnalysisStageId): string | undefined {
  return stages.find((stage) => stage.id === id)?.detail;
}

export function stageSourceOf(stages: AnalysisStage[], id: AnalysisStageId): string | undefined {
  return stages.find((stage) => stage.id === id)?.source;
}
