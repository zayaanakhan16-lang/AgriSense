import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MapPin, Search, X, Sprout } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SAMPLE_LOCATIONS, searchPlaces } from '@/services/geocode';
import { useMapStore, useSearchStore } from '@/store/mapStore';
import { useFieldsStore } from '@/store/fieldsStore';
import type { SearchResult } from '@/types';

export function SearchPanel(): JSX.Element {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { query, setQuery, setOpen } = useSearchStore();
  const flyTo = useMapStore((s) => s.flyTo);
  const fields = useFieldsStore((s) => s.fields);
  const selectField = useFieldsStore((s) => s.selectField);

  const trimmed = query.trim();
  const enabled = trimmed.length >= 3;

  const { data, isFetching, isError } = useQuery({
    queryKey: ['geocode', trimmed],
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: ({ signal }) => searchPlaces(trimmed, signal),
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSelect = (result: SearchResult): void => {
    flyTo({ coord: result.center, zoom: result.zoom ?? (result.bbox ? 13 : 11), bbox: result.bbox });
    setOpen(false);
    setQuery('');
  };

  const localMatches = trimmed
    ? fields.filter((field) => field.name.toLowerCase().includes(trimmed.toLowerCase()))
    : [];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-display text-sm font-semibold">Find a farm or place</h2>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              Search anywhere on Earth, or jump to one of your fields.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(false)}
            aria-label="Close search"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="City, district, farm or coordinates"
            className="pl-9"
            aria-label="Search location"
            autoComplete="off"
          />
          {isFetching ? (
            <Loader2 className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-lime" />
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {localMatches.length > 0 ? (
          <section className="mb-5">
            <h3 className="label-caps mb-2">Your fields</h3>
            <ul className="space-y-1.5">
              {localMatches.map((field) => (
                <li key={field.id}>
                  <button
                    type="button"
                    onClick={() => {
                      selectField(field.id);
                      flyTo({ coord: field.boundary.centroid, zoom: 16, bbox: field.boundary.bbox });
                      setOpen(false);
                      navigate('/intelligence');
                    }}
                    className="flex w-full items-start gap-2.5 rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5 text-left transition-colors hover:border-lime/40 hover:bg-lime/[0.06]"
                  >
                    <Sprout className="mt-0.5 size-3.5 shrink-0 text-lime" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{field.name}</span>
                      <span className="block truncate text-2xs text-muted-foreground">{field.locationLabel}</span>
                    </span>
                    <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                      {(field.boundary.areaM2 / 10000).toFixed(2)} ha
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {enabled ? (
          <section className="mb-5">
            <h3 className="label-caps mb-2">Places</h3>
            {isError ? (
              <p className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-2xs leading-relaxed text-amber-100">
                Place search is unavailable right now. The OpenStreetMap Nominatim service could not be reached — you can
                still navigate the globe directly and draw a field.
              </p>
            ) : null}
            <ul className="space-y-1.5">
              {(data ?? []).map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(result)}
                    className="flex w-full items-start gap-2.5 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-muted/40"
                  >
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{result.name}</span>
                      <span className="block truncate text-2xs text-muted-foreground">{result.subtitle}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!isFetching && data && data.length === 0 ? (
              <p className="px-3 py-2 text-2xs text-muted-foreground">No matching places were returned.</p>
            ) : null}
          </section>
        ) : null}

        <section>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="label-caps">Sample walkthrough locations</h3>
            <Badge variant="warning">Sample</Badge>
          </div>
          <p className="mb-2.5 text-2xs leading-relaxed text-muted-foreground">
            Reference fields from the AgriSense walkthrough. These are demonstration coordinates, not live farm records.
          </p>
          <ul className="space-y-1.5">
            {SAMPLE_LOCATIONS.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(result)}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 text-left transition-colors',
                    'hover:border-lime/40 hover:bg-lime/[0.06]',
                  )}
                >
                  <Sprout className="mt-0.5 size-3.5 shrink-0 text-lime/80" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{result.name}</span>
                    <span className="block truncate text-2xs text-muted-foreground">{result.subtitle}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
