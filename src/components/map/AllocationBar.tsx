import { cn } from '@/lib/utils';

export interface AllocationSegment {
  id: string;
  label: string;
  color: string;
  share: number;
  detail?: string;
}

/**
 * Horizontal allocation bar. Used instead of a donut so the proportion of each
 * crop reads at a glance next to its area and percentage.
 */
export function AllocationBar({
  segments,
  className,
  showLegend = true,
}: {
  segments: AllocationSegment[];
  className?: string;
  showLegend?: boolean;
}): JSX.Element {
  const total = segments.reduce((acc, segment) => acc + Math.max(0, segment.share), 0);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((segment) => (
          <span
            key={segment.id}
            style={{ width: `${total > 0 ? (Math.max(0, segment.share) / total) * 100 : 0}%`, background: segment.color }}
            title={`${segment.label} · ${Math.round(segment.share * 100)}%`}
            aria-hidden
          />
        ))}
      </div>

      {showLegend ? (
        <ul className="space-y-1.5">
          {segments.map((segment) => (
            <li key={segment.id} className="flex items-center gap-2 text-2xs">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: segment.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">{segment.label}</span>
              {segment.detail ? (
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">{segment.detail}</span>
              ) : null}
              <span className="w-10 shrink-0 text-right font-mono tabular-nums text-muted-foreground">
                {Math.round(segment.share * 100)}%
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
