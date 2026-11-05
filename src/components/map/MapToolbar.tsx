import { useState } from 'react';
import {
  Compass,
  Layers,
  LocateFixed,
  Map as MapIcon,
  Minus,
  Pencil,
  Plus,
  Satellite,
  Tags,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { BASEMAP_ORDER, type BasemapDefinition, type BasemapId } from '@/store/mapStore';

export type MapViewMode = 'map' | 'navigation';

export interface MapToolbarProps {
  basemap: BasemapId;
  basemaps: BasemapDefinition[];
  onSelectBasemap: (id: BasemapId) => void;
  viewMode: MapViewMode;
  onToggleView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  drawing: boolean;
  onStartDraw: () => void;
  onLocate: () => void;
  labelsVisible: boolean;
  onToggleLabels: () => void;
  onResetNorth: () => void;
  className?: string;
}

/**
 * Vertical map toolbar pinned to the left edge of the map workspace.
 *
 * Layers, zoom, the map/navigation view switch, region drawing and the extra
 * map tools all live here so the right edge stays clear for the Region List.
 */
export function MapToolbar({
  basemap,
  basemaps,
  onSelectBasemap,
  viewMode,
  onToggleView,
  onZoomIn,
  onZoomOut,
  drawing,
  onStartDraw,
  onLocate,
  labelsVisible,
  onToggleLabels,
  onResetNorth,
  className,
}: MapToolbarProps): JSX.Element {
  const [layersOpen, setLayersOpen] = useState(false);
  const active = basemaps.find((option) => option.id === basemap);

  return (
    <div className={cn('pointer-events-auto flex flex-col items-center gap-2', className)}>
      {/* ------------------------------------------------------------- layers */}
      <div className="relative">
        <ToolbarButton
          label="Map layers"
          pressed={layersOpen}
          onClick={() => setLayersOpen((value) => !value)}
        >
          <Layers className="size-4" />
        </ToolbarButton>

        {layersOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="Close layer menu"
              onClick={() => setLayersOpen(false)}
            />
            <ul role="listbox" className="chrome absolute left-11 top-0 z-50 w-[262px] overflow-hidden p-1.5">
              {BASEMAP_ORDER.map((id) => {
                const option = basemaps.find((o) => o.id === id);
                if (!option) return null;
                const selected = id === basemap;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onSelectBasemap(id);
                        setLayersOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                        selected ? 'bg-lime/12' : 'hover:bg-white/[0.06]',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                          selected ? 'border-lime bg-lime' : 'border-white/25',
                        )}
                        aria-hidden
                      >
                        {selected ? <span className="size-1.5 rounded-full bg-forest-900" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className={cn('text-xs font-semibold', selected ? 'text-lime' : 'text-cream')}>
                            {option.label}
                          </span>
                          {option.kind === 'vector' ? <Badge variant="lime">Vector</Badge> : null}
                        </span>
                        <span className="mt-0.5 block text-2xs leading-relaxed text-cream/55">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </div>

      {/* ------------------------------------------------------------- zoom */}
      <div className="flex flex-col overflow-hidden rounded-full border border-white/10 bg-forest-950/75 shadow-float backdrop-blur">
        <button
          type="button"
          onClick={onZoomIn}
          className="flex size-9 items-center justify-center text-cream/80 transition-colors hover:bg-white/10 hover:text-cream"
          aria-label="Zoom in"
        >
          <Plus className="size-4" />
        </button>
        <span className="mx-auto h-px w-5 bg-white/10" aria-hidden />
        <button
          type="button"
          onClick={onZoomOut}
          className="flex size-9 items-center justify-center text-cream/80 transition-colors hover:bg-white/10 hover:text-cream"
          aria-label="Zoom out"
        >
          <Minus className="size-4" />
        </button>
      </div>

      {/* -------------------------------------------------------- view switch */}
      <ToolbarButton
        label={viewMode === 'map' ? 'Switch to navigation view' : 'Switch to map view'}
        onClick={onToggleView}
        pressed={viewMode === 'navigation'}
      >
        {viewMode === 'map' ? <MapIcon className="size-4" /> : <Satellite className="size-4" />}
      </ToolbarButton>

      {/* ------------------------------------------------------------- tools */}
      <div className="flex flex-col items-center gap-2 rounded-full border border-white/10 bg-forest-950/75 p-1 shadow-float backdrop-blur">
        <ToolbarButton label="Draw region" onClick={onStartDraw} pressed={drawing} bare>
          <Pencil className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Go to my location" onClick={onLocate} bare>
          <LocateFixed className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label={labelsVisible ? 'Hide place labels' : 'Show place labels'}
          onClick={onToggleLabels}
          pressed={labelsVisible}
          bare
        >
          <Tags className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Reset orientation to north" onClick={onResetNorth} bare>
          <Compass className="size-4" />
        </ToolbarButton>
      </div>

      {active ? (
        <span className="chrome mt-0.5 max-w-[92px] px-2 py-1 text-center text-[0.5625rem] font-medium uppercase tracking-[0.08em] text-cream/60">
          {active.short}
        </span>
      ) : null}
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  pressed = false,
  bare = false,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  bare?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={pressed}
          className={cn(
            'flex size-9 items-center justify-center transition-colors',
            bare ? 'rounded-full' : 'rounded-full border shadow-float backdrop-blur',
            pressed
              ? 'border-lime/40 bg-lime/15 text-lime'
              : 'border-white/10 bg-forest-950/75 text-cream/75 hover:text-cream',
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
