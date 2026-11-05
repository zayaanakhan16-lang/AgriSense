import type { ReactNode } from 'react';
import { AlertTriangle, Ban, Inbox, RefreshCw, Satellite } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DataOrigin, DataSourceRef } from '@/types';

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: typeof Inbox;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 px-6 py-12 text-center', className)}>
      <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('rounded-xl border border-red-500/30 bg-red-500/[0.06] p-5', className)} role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-red-300">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-red-300/80">{message}</p>
          {onRetry ? (
            <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function UnavailableState({
  title,
  message,
  source,
  className,
}: {
  title: string;
  message: string;
  source?: string;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('rounded-xl border border-border/70 bg-muted/25 p-5', className)}>
      <div className="flex items-start gap-3">
        <Ban className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            <Badge variant="muted">Unavailable</Badge>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{message}</p>
          {source ? <p className="mt-2 text-2xs uppercase tracking-[0.1em] text-muted-foreground/80">Source: {source}</p> : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Provenance vocabulary used across the product. Keep these five words stable —
 * every measurement in AgriSense is labelled with exactly one of them so a reader
 * can tell an observation from a calculation, an estimate from a proposal.
 */
const ORIGIN_LABELS: Record<DataOrigin, { label: string; variant: 'success' | 'info' | 'warning' | 'muted' }> = {
  live: { label: 'Observed', variant: 'success' },
  derived: { label: 'Calculated', variant: 'info' },
  demo: { label: 'Illustrative', variant: 'warning' },
  unavailable: { label: 'Unavailable', variant: 'muted' },
};

/** Provenance tag for user-authored planning content, which is never an observation. */
export function ProposedTag({ className }: { className?: string }): JSX.Element {
  return (
    <Badge variant="info" className={className}>
      Proposed
    </Badge>
  );
}

export function DataOriginBadge({ origin, className }: { origin: DataOrigin; className?: string }): JSX.Element {
  const config = ORIGIN_LABELS[origin];
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

export function SourceNote({ source, className }: { source: DataSourceRef; className?: string }): JSX.Element {
  return (
    <p className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs leading-relaxed text-muted-foreground', className)}>
      <Satellite className="size-3 shrink-0 text-lime/70" aria-hidden />
      <span className="font-medium text-muted-foreground/90">{source.provider}</span>
      <span aria-hidden>·</span>
      <span>{source.label}</span>
      {source.license ? (
        <>
          <span aria-hidden>·</span>
          <span>{source.license}</span>
        </>
      ) : null}
    </p>
  );
}

export function InlineNotice({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'warning' | 'danger';
  children: ReactNode;
  className?: string;
}): JSX.Element {
  const tones = {
    info: 'border-sky-500/25 bg-sky-500/[0.07] text-sky-100',
    warning: 'border-amber-600/30 bg-amber-500/[0.07] text-amber-900',
    danger: 'border-red-600/30 bg-red-500/[0.07] text-red-900',
  } as const;
  return (
    <div className={cn('rounded-lg border px-3 py-2.5 text-xs leading-relaxed', tones[tone], className)}>
      {children}
    </div>
  );
}

export function DemoNotice({ children, className }: { children?: ReactNode; className?: string }): JSX.Element {
  return (
    <InlineNotice tone="warning" className={className}>
      <span className="font-semibold">Sample demonstration data. </span>
      {children ?? 'These figures illustrate the AgriSense workflow. They are not live satellite measurements or guaranteed outcomes.'}
    </InlineNotice>
  );
}
