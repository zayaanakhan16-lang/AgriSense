import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  Loader2,
  Sprout,
  XCircle,
} from 'lucide-react';
import type { AnalysisStage, AnalysisStageId, Field, SoilProfile, ClimateProfile } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { LogoMark } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';
import { formatArea } from '@/lib/format';
import { runFieldAnalysis } from '@/services/analysisRunner';
import { useAnalysisStore, stageProgress } from '@/store/analysisStore';
import { useFieldsStore } from '@/store/fieldsStore';

export interface AnalysisTransitionProps {
  field: Field;
  onComplete: () => void;
  onCancel: () => void;
}

const STAGE_ICONS: Record<AnalysisStageId, typeof Circle> = {
  boundary: Circle,
  imagery: Circle,
  vegetation: Sprout,
  soil: Circle,
  climate: Circle,
  suitability: Circle,
  crops: Circle,
};

function StageRow({ stage, index }: { stage: AnalysisStage; index: number }): JSX.Element {
  const Icon = STAGE_ICONS[stage.id];
  const isActive = stage.state === 'active';
  const isDone = stage.state === 'done';
  const isUnavailable = stage.state === 'unavailable';
  const isError = stage.state === 'error';

  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={cn(
        'relative flex items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors',
        isActive && 'border-lime/40 bg-lime/[0.06]',
        isDone && 'border-border/60 bg-muted/20',
        isUnavailable && 'border-amber-500/25 bg-amber-500/[0.05]',
        isError && 'border-red-500/30 bg-red-500/[0.06]',
        stage.state === 'pending' && 'border-border/40 opacity-55',
      )}
    >
      <div className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
        {isActive ? (
          <Loader2 className="size-4 animate-spin text-lime" />
        ) : isDone ? (
          <CheckCircle2 className="size-4 text-lime" />
        ) : isUnavailable ? (
          <Ban className="size-4 text-amber-400" />
        ) : isError ? (
          <XCircle className="size-4 text-red-400" />
        ) : (
          <Icon className="size-4 text-muted-foreground/50" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('text-sm font-medium', isActive && 'text-lime', stage.state === 'pending' && 'text-muted-foreground')}>
            {stage.label}
          </span>
          {isUnavailable ? <Badge variant="warning">Unavailable</Badge> : null}
          {isError ? <Badge variant="danger">Failed</Badge> : null}
        </div>
        <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
          {stage.detail ?? stage.description}
        </p>
        {stage.source && (isDone || isUnavailable) ? (
          <p className="mt-1 text-2xs text-muted-foreground/70">Source: {stage.source}</p>
        ) : null}
      </div>
    </motion.li>
  );
}

/**
 * The analysis transition. Stages advance only when the real corresponding
 * operation resolves — there are no timed fake progress animations.
 */
export function AnalysisTransition({ field, onComplete, onCancel }: AnalysisTransitionProps): JSX.Element {
  const navigate = useNavigate();
  const { stages, running, completed, error, begin, patchStage, finish, fail } = useAnalysisStore();
  const updateField = useFieldsStore((s) => s.updateField);
  const abortRef = useRef<AbortController | null>(null);
  const fieldRef = useRef(field);
  fieldRef.current = field;

  // Keyed on field.id so the run survives StrictMode's mount/unmount/remount cycle
  // (the first pass is aborted, the second pass re-runs and completes) while still
  // re-running when a genuinely different field arrives.
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    const activeField = fieldRef.current;
    begin(activeField);
    updateField(activeField.id, { status: 'analyzing' });

    runFieldAnalysis(activeField, {
      onStage: patchStage,
      signal: controller.signal,
    })
      .then((outcome) => {
        if (controller.signal.aborted) return;
        finish(outcome);
        const soil = outcome.soil.value;
        updateField(activeField.id, {
          status: 'ready',
          soilTexture: soil?.texture?.label ?? activeField.soilTexture,
        });
      })
      .catch((analysisError: unknown) => {
        if (controller.signal.aborted) return;
        fail(analysisError instanceof Error ? analysisError.message : 'The analysis pipeline failed.');
        updateField(activeField.id, { status: 'error' });
      });

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.id]);

  const progress = stageProgress(stages);
  const unavailableCount = stages.filter((s) => s.state === 'unavailable' || s.state === 'error').length;

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-forest-950 p-4 sm:p-8">
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime/[0.05] blur-3xl" />

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-3xl"
      >
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-forest-900/80 shadow-float backdrop-blur">
          <div className="relative border-b border-white/10 p-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime/60 to-transparent" />
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <LogoMark className="size-10 rounded-xl" />
                <div>
                  <h1 className="font-display text-lg font-semibold text-cream">
                    {running ? 'Analysing selected land' : completed ? 'Field intelligence ready' : 'Analysis stopped'}
                  </h1>
                  <p className="mt-1 text-xs text-cream/65">
                    {field.name} · {formatArea(field.boundary.areaM2)} · {field.boundary.vertexCount} vertices
                  </p>
                </div>
              </div>
              <Badge variant={running ? 'lime' : completed ? 'success' : 'danger'}>
                {running ? 'In progress' : completed ? 'Complete' : 'Failed'}
              </Badge>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-2xs text-cream/60">
                <span>
                  {progress.done} of {progress.total} operations resolved
                </span>
                <span className="font-mono">{Math.round(progress.fraction * 100)}%</span>
              </div>
              <Progress value={progress.fraction * 100} className="bg-white/10" />
              {unavailableCount > 0 ? (
                <p className="mt-2 flex items-center gap-1.5 text-2xs text-amber-200/80">
                  <AlertTriangle className="size-3" />
                  {unavailableCount} operation{unavailableCount === 1 ? '' : 's'} could not complete and{' '}
                  {unavailableCount === 1 ? 'is' : 'are'} reported honestly below.
                </p>
              ) : null}
            </div>
          </div>

          <div className="max-h-[52vh] overflow-y-auto p-5">
            <ul className="space-y-2.5">
              {stages.map((stage, index) => (
                <StageRow key={stage.id} stage={stage} index={index} />
              ))}
            </ul>

            <AnimatePresence>
              {error ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 overflow-hidden"
                >
                  <div className="rounded-lg border border-red-500/30 bg-red-500/[0.07] p-3.5">
                    <p className="text-xs font-semibold text-red-200">Analysis could not complete</p>
                    <p className="mt-1 text-2xs leading-relaxed text-red-200/80">{error}</p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-forest-950/60 p-5">
            <p className="max-w-sm text-2xs leading-relaxed text-cream/50">
              Every stage above maps to a real operation. Unavailable providers are labelled rather than substituted with
              synthetic values.
            </p>
            <div className="flex items-center gap-2">
              {running ? (
                <Button
                  variant="shell"
                  className="border border-white/10"
                  onClick={() => {
                    abortRef.current?.abort();
                    onCancel();
                  }}
                >
                  Cancel
                </Button>
              ) : (
                <>
                  <Button variant="shell" className="border border-white/10" onClick={onCancel}>
                    Back to globe
                  </Button>
                  <Button
                    variant="lime"
                    onClick={() => {
                      onComplete();
                      navigate('/intelligence');
                    }}
                    disabled={!completed}
                  >
                    <Sprout className="size-4" />
                    Open field intelligence
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export type { SoilProfile, ClimateProfile };
