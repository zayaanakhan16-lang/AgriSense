import { Database, Globe2, Satellite } from 'lucide-react';
import type { Field } from '@/types';
import { cn } from '@/lib/utils';
import { formatArea, formatCoord } from '@/lib/format';

/**
 * Compact AgriSense status bar pinned to the bottom of the Earth Explorer.
 *
 * It reports genuine map/data status only — no invented progress or activity.
 */
export function MapStatusBar({
  fields,
  basemapLabel,
  imageryLabel,
  selectedField,
  className,
}: {
  fields: number;
  basemapLabel: string;
  imageryLabel: string;
  selectedField: Field | null;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('chrome flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-2.5', className)}>
      <span className="flex items-center gap-2">
        <span className="relative flex size-2">
          <span className="relative inline-flex size-2 rounded-full bg-lime" />
        </span>
        <span className="text-2xs font-medium text-cream/85">AgriSense online</span>
      </span>

      <span className="hidden h-4 w-px bg-white/12 sm:block" aria-hidden />

      <span className="flex items-center gap-1.5">
        <Globe2 className="size-3 text-lime" aria-hidden />
        <span className="text-2xs text-cream/55">Basemap</span>
        <span className="text-2xs font-medium text-cream/85">{basemapLabel}</span>
      </span>

      <span className="hidden h-4 w-px bg-white/12 sm:block" aria-hidden />

      <span className="flex items-center gap-1.5">
        <Satellite className="size-3 text-lime" aria-hidden />
        <span className="text-2xs text-cream/55">Imagery</span>
        <span className="text-2xs font-medium text-cream/85">{imageryLabel}</span>
      </span>

      <span className="hidden h-4 w-px bg-white/12 md:block" aria-hidden />

      <span className="hidden items-center gap-1.5 md:flex">
        <Database className="size-3 text-lime" aria-hidden />
        <span className="text-2xs text-cream/55">Regions</span>
        <span className="font-mono text-2xs tabular-nums text-cream/85">{fields}</span>
      </span>

      {selectedField ? (
        <>
          <span className="hidden h-4 w-px bg-white/12 lg:block" aria-hidden />
          <span className="flex items-center gap-1.5">
            <span className="text-2xs text-cream/55">Selected</span>
            <span className="max-w-[160px] truncate text-2xs font-medium text-cream/85">
              {selectedField.name}
            </span>
            <span className="font-mono text-2xs tabular-nums text-cream/55">
              {formatArea(selectedField.boundary.areaM2)}
            </span>
            <span className="hidden font-mono text-[0.625rem] tabular-nums text-cream/40 xl:inline">
              {formatCoord(selectedField.boundary.centroid, 3)}
            </span>
          </span>
        </>
      ) : null}
    </div>
  );
}
