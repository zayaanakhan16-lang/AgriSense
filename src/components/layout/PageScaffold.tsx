import type { ReactNode } from 'react';
import { AlertTriangle, Ban, Loader2, RefreshCw } from 'lucide-react';
import type { AnalysisStage, AnalysisStageId } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatArea, relativeTime } from '@/lib/format';
import type { Field } from '@/types';

export function PageScaffold({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3.5 sm:px-6">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold leading-tight">{title}</h2>
          <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}): JSX.Element {
  return (
    <section className={cn('surface overflow-hidden', className)}>
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight">{title}</h3>
            {description ? (
              <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function MetricTile({
  label,
  value,
  unit,
  sub,
  tone = 'default',
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger' | 'muted';
  className?: string;
}): JSX.Element {
  const tones = {
    default: 'text-foreground',
    positive: 'text-lime',
    warning: 'text-amber-300',
    danger: 'text-red-300',
    muted: 'text-muted-foreground',
  } as const;
  return (
    <div className={cn('rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5', className)}>
      <div className="label-caps">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={cn('font-mono text-lg font-semibold tabular-nums', tones[tone])}>{value}</span>
        {unit ? <span className="text-2xs text-muted-foreground">{unit}</span> : null}
      </div>
      {sub ? <div className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

const STAGE_LABELS: Record<AnalysisStageId, string> = {
  boundary: 'Boundary',
  imagery: 'Imagery',
  vegetation: 'Vegetation',
  soil: 'Soil',
  climate: 'Climate',
  suitability: 'Suitability',
  crops: 'Crops',
};

export function StageStatusStrip({ stages }: { stages: AnalysisStage[] }): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {stages.map((stage) => {
        const tone =
          stage.state === 'done'
            ? 'border-lime-600/40 bg-lime/15 text-lime'
            : stage.state === 'active'
              ? 'border-lime-600/55 bg-lime/20 text-lime'
              : stage.state === 'unavailable'
                ? 'border-amber-600/35 bg-amber-500/10 text-amber-300'
                : stage.state === 'error'
                  ? 'border-red-600/35 bg-red-500/10 text-red-300'
                  : 'border-border/60 bg-muted/40 text-muted-foreground';
        return (
          <span
            key={stage.id}
            title={stage.detail ?? stage.description}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-[0.06em]',
              tone,
            )}
          >
            {stage.state === 'active' ? <Loader2 className="size-2.5 animate-spin" /> : null}
            {stage.state === 'unavailable' || stage.state === 'error' ? <Ban className="size-2.5" /> : null}
            {STAGE_LABELS[stage.id]}
          </span>
        );
      })}
    </div>
  );
}

export function FieldHeaderCard({
  field,
  analysedAt,
  onRefresh,
  refreshing,
  stages,
}: {
  field: Field;
  analysedAt: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  stages?: AnalysisStage[];
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-display text-sm font-semibold">{field.name}</h3>
          {field.isSample ? <Badge variant="warning">Sample field</Badge> : null}
          <Badge variant="outline">{formatArea(field.boundary.areaM2)}</Badge>
          <Badge variant="outline">{field.boundary.vertexCount} vertices</Badge>
        </div>
        <p className="mt-1 truncate text-2xs text-muted-foreground">
          {field.locationLabel}
          {analysedAt ? ` · analysed ${relativeTime(analysedAt)}` : ''}
        </p>
        {stages ? (
          <div className="mt-2">
            <StageStatusStrip stages={stages} />
          </div>
        ) : null}
      </div>
      {onRefresh ? (
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Re-run analysis
        </Button>
      ) : null}
    </div>
  );
}

export function AnalysisErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3">
      <AlertTriangle className="size-4 shrink-0 text-red-600" />
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-red-900">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function SkeletonPanel({ rows = 3, className }: { rows?: number; className?: string }): JSX.Element {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="skeleton size-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-2.5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
