import { useMemo, useState } from 'react';
import { ArrowUpDown, ChevronDown, MapPin, Plus, Search, Sprout } from 'lucide-react';
import type { Field } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatArea, relativeTime } from '@/lib/format';

type SortKey = 'recent' | 'name' | 'area';

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Recent',
  name: 'Name',
  area: 'Area',
};

/**
 * Region List — the saved-farm index shown on the Earth Explorer.
 *
 * The Earth is the primary surface, so this stays a compact floating panel:
 * search, sort and a dense list rather than a table that would fight the map.
 */
export function RegionList({
  fields,
  selectedFieldId,
  onSelect,
  onAddFarm,
  className,
}: {
  fields: Field[];
  selectedFieldId: string | null;
  onSelect: (id: string) => void;
  onAddFarm?: () => void;
  className?: string;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [collapsed, setCollapsed] = useState(false);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matched = term
      ? fields.filter(
          (field) =>
            field.name.toLowerCase().includes(term) ||
            field.locationLabel.toLowerCase().includes(term),
        )
      : fields;
    const sorted = [...matched];
    sorted.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'area') return b.boundary.areaM2 - a.boundary.areaM2;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted;
  }, [fields, query, sort]);

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="type-section flex items-center gap-1.5 text-cream">
          <MapPin className="size-3.5 text-lime" aria-hidden />
          Region list
        </h2>
        <span className="flex items-center gap-1.5">
          <Badge variant="lime">{fields.length}</Badge>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand region list' : 'Collapse region list'}
            className="rounded-md p-1 text-cream/45 transition-colors hover:bg-white/10 hover:text-cream"
          >
            <ChevronDown className={cn('size-3.5 transition-transform', collapsed && '-rotate-90')} aria-hidden />
          </button>
        </span>
      </div>

      {collapsed ? null : fields.length ? (
        <>
          <div className="relative mt-2.5">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-cream/40"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search regions"
              aria-label="Search regions"
              className="h-8 border-white/12 bg-white/[0.06] pl-7 text-xs text-cream placeholder:text-cream/35 focus-visible:ring-lime"
            />
          </div>

          <div className="mt-2 flex items-center gap-1">
            <ArrowUpDown className="size-3 shrink-0 text-cream/35" aria-hidden />
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                aria-pressed={sort === key}
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-[0.06em] transition-colors',
                  sort === key ? 'bg-lime/20 text-lime' : 'text-cream/45 hover:text-cream/80',
                )}
              >
                {SORT_LABELS[key]}
              </button>
            ))}
          </div>

          <ul className="mt-2 max-h-[34vh] space-y-1 overflow-y-auto pr-0.5">
            {visible.map((field) => {
              const active = field.id === selectedFieldId;
              return (
                <li key={field.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(field.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                      active ? 'bg-lime/15 ring-1 ring-inset ring-lime/30' : 'hover:bg-white/[0.07]',
                    )}
                  >
                    <Sprout
                      className={cn('size-3.5 shrink-0', active ? 'text-lime' : 'text-cream/45')}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-cream/90">{field.name}</span>
                      <span className="block truncate text-[0.625rem] text-cream/40">
                        {field.locationLabel} · {relativeTime(field.createdAt)}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-2xs tabular-nums text-cream/55">
                      {formatArea(field.boundary.areaM2)}
                    </span>
                  </button>
                </li>
              );
            })}
            {!visible.length ? (
              <li className="rounded-lg border border-dashed border-white/12 px-3 py-4 text-center text-2xs text-cream/45">
                No region matches “{query}”.
              </li>
            ) : null}
          </ul>

          {onAddFarm ? (
            <button
              type="button"
              onClick={onAddFarm}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-lime/30 bg-lime/10 px-2 py-1.5 text-2xs font-medium text-lime transition-colors hover:bg-lime/20"
            >
              <Plus className="size-3.5" aria-hidden />
              Add farm
            </button>
          ) : null}
        </>
      ) : (
        <div className="mt-4 flex flex-col items-center px-1 text-center">
          <span className="flex size-12 items-center justify-center rounded-full border border-dashed border-white/20">
            <MapPin className="size-4 text-cream/40" aria-hidden />
          </span>
          <p className="mt-3 text-xs font-semibold text-cream/85">No regions yet</p>
          <p className="mt-1 text-[0.625rem] leading-relaxed text-cream/45">
            Create your first region to get started.
          </p>
          <ol className="mt-3.5 w-full space-y-2 text-left">
            {[
              'Select the drawing tool on the left toolbar.',
              'Click the map to place boundary points.',
              'Press Enter to save or Escape to cancel.',
            ].map((step, index) => (
              <li key={step} className="flex items-start gap-2">
                <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-lime/15 font-mono text-[0.5625rem] font-semibold text-lime">
                  {index + 1}
                </span>
                <span className="text-[0.625rem] leading-relaxed text-cream/55">{step}</span>
              </li>
            ))}
          </ol>
          {onAddFarm ? (
            <button
              type="button"
              onClick={onAddFarm}
              className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-lime/30 bg-lime/10 px-2 py-1.5 text-2xs font-medium text-lime transition-colors hover:bg-lime/20"
            >
              <Plus className="size-3.5" aria-hidden />
              Add farm
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
