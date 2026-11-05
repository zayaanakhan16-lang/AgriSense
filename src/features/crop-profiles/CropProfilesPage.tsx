import { useMemo, useState } from 'react';
import { Sprout } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EarthMap } from '@/components/map/EarthMap';
import { useFieldsStore } from '@/store/fieldsStore';
import { buildCropProfilePoints } from '@/lib/cropProfiles';
import { CROP_PROFILE_CATEGORIES, CROP_PROFILE_COLORS } from '@/data/regions';

type Filter = 'All' | (typeof CROP_PROFILE_CATEGORIES)[number];

/**
 * Crop Profiles on the satellite map.
 *
 * A grid of sample points is generated inside the selected region's boundary and
 * clipped to it, so no point ever falls outside the field. Colours encode the
 * crop profile; the legend doubles as a filter.
 */
export default function CropProfilesPage(): JSX.Element {
  const fields = useFieldsStore((s) => s.fields);
  const selectedFieldId = useFieldsStore((s) => s.selectedFieldId);
  const field = fields.find((entry) => entry.id === selectedFieldId) ?? fields[0] ?? null;

  const [filter, setFilter] = useState<Filter>('All');

  const points = useMemo(() => (field ? buildCropProfilePoints(field.boundary.coords) : []), [field]);

  const markers = useMemo(
    () =>
      points
        .filter((point) => filter === 'All' || point.category === filter)
        .map((point) => ({ coord: point.coord, color: point.color, radius: 2.6 })),
    [points, filter],
  );

  if (!field) {
    return (
      <div className="flex size-full items-center justify-center bg-forest-950">
        <div className="chrome max-w-sm p-6 text-center">
          <Sprout className="mx-auto size-6 text-lime" aria-hidden />
          <h1 className="mt-3 type-section text-cream">No region selected</h1>
          <p className="mt-1 text-2xs leading-relaxed text-cream/60">
            Select a region to render its crop profiles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative size-full overflow-hidden bg-forest-950">
      <EarthMap fieldCoords={field.boundary.coords} markers={markers} compact className="size-full" />

      {/* ------------------------------------------------------------- header */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center p-3 sm:p-4">
        <div className="chrome pointer-events-auto flex items-center gap-2.5 px-3.5 py-2">
          <Sprout className="size-3.5 text-lime" aria-hidden />
          <span className="text-xs font-semibold text-cream">Crop Profiles</span>
          <Badge variant="lime">{field.name}</Badge>
          <span className="font-mono text-2xs tabular-nums text-cream/55">
            {markers.length} / {points.length} pts
          </span>
        </div>
      </div>

      {/* -------------------------------------------------------------- legend */}
      <div className="absolute bottom-3 left-3 z-20 sm:bottom-4 sm:left-4">
        <div className="chrome p-3">
          <p className="mb-2 text-3xs font-semibold uppercase tracking-[0.12em] text-cream/55">Crop profile</p>
          <ul className="space-y-1.5">
            <li>
              <button
                type="button"
                onClick={() => setFilter('All')}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1 text-2xs transition-colors',
                  filter === 'All' ? 'bg-lime/15 text-lime' : 'text-cream/70 hover:bg-white/10',
                )}
              >
                <span className="size-2.5 rounded-full border border-white/40" aria-hidden />
                All
              </button>
            </li>
            {CROP_PROFILE_CATEGORIES.map((category) => (
              <li key={category}>
                <button
                  type="button"
                  onClick={() => setFilter(filter === category ? 'All' : category)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1 text-2xs transition-colors',
                    filter === category ? 'bg-lime/15 text-lime' : 'text-cream/70 hover:bg-white/10',
                  )}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: CROP_PROFILE_COLORS[category] }}
                    aria-hidden
                  />
                  {category}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
