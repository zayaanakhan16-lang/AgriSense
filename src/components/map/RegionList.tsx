import { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  ChevronDown,
  Filter,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  ZoomIn,
} from 'lucide-react';
import type { Field } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatAcres } from '@/lib/format';
import { regionColorHex } from '@/data/regions';

type SortKey = 'recent' | 'name' | 'area';

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Recent',
  name: 'Name',
  area: 'Area',
};

/** Small yellow-gold polygon glyph used on every region card. */
function PolygonGlyph({ color, className }: { color?: string; className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" className={cn('size-4 shrink-0', className)} aria-hidden>
      <polygon
        points="2,11 6,3 14,7 11,14"
        fill={regionColorHex(color)}
        fillOpacity={0.28}
        stroke={regionColorHex(color)}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Region List — the saved-region index shown beside the map and analytics.
 *
 * The map is the primary surface, so this stays a compact floating panel:
 * search, filter, sort and a dense list of region cards.
 */
export function RegionList({
  fields,
  selectedFieldId,
  onSelect,
  onZoom,
  onEdit,
  onDelete,
  onAddRegion,
  className,
}: {
  fields: Field[];
  selectedFieldId: string | null;
  onSelect: (id: string) => void;
  onZoom?: (field: Field) => void;
  onEdit?: (field: Field) => void;
  onDelete?: (field: Field) => void;
  onAddRegion?: () => void;
  className?: string;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [collapsed, setCollapsed] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [cropFilter, setCropFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'rural' | 'urban'>('all');
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const crops = useMemo(() => {
    const set = new Set<string>();
    fields.forEach((field) => {
      if (field.crop) set.add(field.crop);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [fields]);

  const activeFilters = (cropFilter ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matched = fields.filter((field) => {
      if (cropFilter && field.crop !== cropFilter) return false;
      if (typeFilter !== 'all' && (field.regionType ?? 'rural') !== typeFilter) return false;
      if (!term) return true;
      return (
        field.name.toLowerCase().includes(term) ||
        field.locationLabel.toLowerCase().includes(term) ||
        (field.crop?.toLowerCase().includes(term) ?? false)
      );
    });
    const sorted = [...matched];
    sorted.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'area') return b.boundary.areaM2 - a.boundary.areaM2;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted;
  }, [fields, query, sort, cropFilter, typeFilter]);

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="type-section flex items-center gap-1.5 text-cream">
          <MapPin className="size-3.5 text-lime" aria-hidden />
          Region List
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

      {collapsed ? null : (
        <>
          {/* ------------------------------------------------- search + filter */}
          <div className="mt-2.5 flex items-center gap-1.5">
            <div className="relative min-w-0 flex-1">
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
            <button
              type="button"
              onClick={() => setFilterOpen((value) => !value)}
              aria-expanded={filterOpen}
              aria-label="Filter regions"
              className={cn(
                'relative flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors',
                filterOpen || activeFilters
                  ? 'border-lime/40 bg-lime/15 text-lime'
                  : 'border-white/12 bg-white/[0.06] text-cream/60 hover:text-cream',
              )}
            >
              <Filter className="size-3.5" />
              {activeFilters ? (
                <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-lime font-mono text-[0.5rem] font-bold text-forest-950">
                  {activeFilters}
                </span>
              ) : null}
            </button>
          </div>

          {filterOpen ? (
            <div className="mt-2 space-y-2.5 rounded-lg border border-white/10 bg-black/25 p-2.5">
              <div>
                <span className="label-caps text-cream/45">Crop / land use</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <FilterChip active={cropFilter === null} onClick={() => setCropFilter(null)}>
                    All
                  </FilterChip>
                  {crops.map((crop) => (
                    <FilterChip
                      key={crop}
                      active={cropFilter === crop}
                      onClick={() => setCropFilter(cropFilter === crop ? null : crop)}
                    >
                      {crop}
                    </FilterChip>
                  ))}
                </div>
              </div>
              <div>
                <span className="label-caps text-cream/45">Region type</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(['all', 'rural', 'urban'] as const).map((type) => (
                    <FilterChip key={type} active={typeFilter === type} onClick={() => setTypeFilter(type)}>
                      {type === 'all' ? 'All types' : type === 'rural' ? 'Rural' : 'Urban'}
                    </FilterChip>
                  ))}
                </div>
              </div>
              {activeFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setCropFilter(null);
                    setTypeFilter('all');
                  }}
                  className="text-[0.625rem] font-medium text-lime hover:underline"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : null}

          {/* ---------------------------------------------------------- sort */}
          <div className="mt-2 flex items-center gap-1">
            <ArrowUpDown className="size-3 shrink-0 text-cream/35" aria-hidden />
            <span className="text-[0.625rem] uppercase tracking-[0.08em] text-cream/40">Sort</span>
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

          {/* ---------------------------------------------------- region cards */}
          {fields.length ? (
            <>
              <ul className="mt-2 max-h-[40vh] space-y-1.5 overflow-y-auto pr-0.5">
                {visible.map((field) => {
                  const active = field.id === selectedFieldId;
                  return (
                    <li key={field.id} className="relative">
                      <button
                        type="button"
                        onClick={() => onSelect(field.id)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 pr-8 text-left transition-colors',
                          active
                            ? 'border-lime/35 bg-lime/[0.12]'
                            : 'border-transparent hover:border-white/10 hover:bg-white/[0.06]',
                        )}
                      >
                        <span className="mt-0.5">
                          <PolygonGlyph color={field.color} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-semibold text-cream/95">{field.name}</span>
                            {field.crop ? (
                              <span className="shrink-0 rounded-sm bg-white/[0.08] px-1 py-px text-[0.5625rem] font-medium text-cream/70">
                                {field.crop}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-[0.625rem] text-cream/45">
                            <span className="font-mono tabular-nums text-cream/65">
                              {formatAcres(field.boundary.areaM2)}
                            </span>
                            <span className="text-cream/25">·</span>
                            <span className="truncate">{field.locationLabel}</span>
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMenuFor(menuFor === field.id ? null : field.id)}
                        aria-label={`Actions for ${field.name}`}
                        aria-expanded={menuFor === field.id}
                        className="absolute right-1.5 top-1.5 rounded-md p-1 text-cream/40 transition-colors hover:bg-white/10 hover:text-cream"
                      >
                        <MoreVertical className="size-3.5" />
                      </button>

                      {menuFor === field.id ? (
                        <>
                          <button
                            type="button"
                            className="fixed inset-0 z-20 cursor-default"
                            aria-label="Close region menu"
                            onClick={() => setMenuFor(null)}
                          />
                          <ul className="chrome absolute right-1.5 top-8 z-30 w-[170px] overflow-hidden p-1">
                            {onZoom ? (
                              <MenuItem
                                icon={ZoomIn}
                                label="Zoom to region"
                                onClick={() => {
                                  onZoom(field);
                                  setMenuFor(null);
                                }}
                              />
                            ) : null}
                            {onEdit ? (
                              <MenuItem
                                icon={Pencil}
                                label="Edit region"
                                onClick={() => {
                                  onEdit(field);
                                  setMenuFor(null);
                                }}
                              />
                            ) : null}
                            {onDelete ? (
                              <MenuItem
                                icon={Trash2}
                                label="Delete region"
                                tone="danger"
                                onClick={() => {
                                  onDelete(field);
                                  setMenuFor(null);
                                }}
                              />
                            ) : null}
                          </ul>
                        </>
                      ) : null}
                    </li>
                  );
                })}
                {!visible.length ? (
                  <li className="rounded-lg border border-dashed border-white/12 px-3 py-4 text-center text-2xs text-cream/45">
                    No region matches the current search or filters.
                  </li>
                ) : null}
              </ul>

              <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.08] pt-2.5">
                <span className="text-2xs text-cream/50">
                  <span className="font-mono tabular-nums text-cream/80">{visible.length}</span>
                  {visible.length === 1 ? ' region' : ' regions'}
                  {visible.length !== fields.length ? ` of ${fields.length}` : ''}
                </span>
                {onAddRegion ? (
                  <button
                    type="button"
                    onClick={onAddRegion}
                    className="flex items-center gap-1 rounded-md px-1.5 py-1 text-2xs font-medium text-lime transition-colors hover:bg-lime/10"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    New region
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <EmptyRegions onAddRegion={onAddRegion} />
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-2 py-0.5 text-[0.625rem] font-medium transition-colors',
        active
          ? 'border-lime/45 bg-lime/15 text-lime'
          : 'border-white/12 bg-white/[0.04] text-cream/55 hover:text-cream/85',
      )}
    >
      {children}
    </button>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  tone = 'default',
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}): JSX.Element {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-2xs transition-colors',
          tone === 'danger'
            ? 'text-red-300 hover:bg-red-500/15'
            : 'text-cream/80 hover:bg-white/10 hover:text-cream',
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {label}
      </button>
    </li>
  );
}

function EmptyRegions({ onAddRegion }: { onAddRegion?: () => void }): JSX.Element {
  return (
    <div className="mt-5 flex flex-col items-center px-1 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-dashed border-white/20">
        <MapPin className="size-4 text-cream/40" aria-hidden />
      </span>
      <p className="mt-3 text-xs font-semibold text-cream/85">No regions yet</p>
      <p className="mt-1 text-[0.625rem] leading-relaxed text-cream/45">
        Create your first region to get started.
      </p>
      <ol className="mt-3.5 w-full space-y-2 text-left">
        {[
          'Click the drawing tool on the left toolbar.',
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
      {onAddRegion ? (
        <button
          type="button"
          onClick={onAddRegion}
          className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-lime/30 bg-lime/10 px-2 py-1.5 text-2xs font-medium text-lime transition-colors hover:bg-lime/20"
        >
          <Plus className="size-3.5" aria-hidden />
          New region
        </button>
      ) : null}
    </div>
  );
}
