import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, PanelRight, X } from 'lucide-react';
import { MapAnalyticsToggle, type WorkspaceMode } from '@/components/map/MapAnalyticsToggle';
import { RegionPanel } from '@/components/map/RegionPanel';
import { useFieldsStore } from '@/store/fieldsStore';

const SOURCE_PILLS = [
  { label: 'Basemap', value: 'Sentinel-2 (EOX)' },
  { label: 'Vegetation', value: 'Sentinel-2 L2A' },
  { label: 'Soil', value: 'SoilGrids v2.0' },
  { label: 'Weather', value: 'Open-Meteo' },
];

/**
 * Shared shell for the Earth Explorer map view and the Region Analytics view.
 *
 * The map workspace takes the remaining width and the Region List sits in a
 * fixed-width column on the right, so the panel never overlaps the workspace.
 * The top-centre Map / Analytics toggle is present on both screens.
 */
export function EarthWorkspace({
  mode,
  children,
  showSources = false,
  onAddRegion,
}: {
  mode: WorkspaceMode;
  children: ReactNode;
  showSources?: boolean;
  onAddRegion?: () => void;
}): JSX.Element {
  const navigate = useNavigate();
  const fields = useFieldsStore((s) => s.fields);
  const selectedFieldId = useFieldsStore((s) => s.selectedFieldId);
  const selected = fields.find((field) => field.id === selectedFieldId) ?? null;
  const [railOpen, setRailOpen] = useState(false);

  const rail = (
    <>
      <div className="chrome p-4">
        <RegionPanel onAddRegion={onAddRegion} />
      </div>

      {showSources ? (
        <div className="chrome p-4">
          <div className="flex items-center gap-2">
            <Database className="size-3.5 text-lime" aria-hidden />
            <h2 className="type-section text-cream">Open data sources</h2>
          </div>
          <ul className="mt-3 space-y-2">
            {SOURCE_PILLS.map((pill) => (
              <li key={pill.label} className="flex items-center justify-between gap-2">
                <span className="text-2xs text-cream/60">{pill.label}</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-2xs font-medium text-cream/85">{pill.value}</span>
                  <span className="size-1.5 rounded-full bg-lime" aria-hidden />
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-white/[0.08] pt-2.5 text-2xs leading-relaxed text-cream/45">
            Keyless and open-licensed. Analytics on this workspace use clearly labelled demonstration values.
          </p>
        </div>
      ) : null}

      <div className="chrome px-4 py-2.5">
        <p className="text-2xs text-cream/55">
          <span className="font-mono tabular-nums text-cream/80">{fields.length}</span>
          {fields.length === 1 ? ' region' : ' regions'} · {selected?.name ?? 'none selected'}
        </p>
      </div>
    </>
  );

  return (
    <div className="flex size-full min-h-0">
      <div className="relative min-w-0 flex-1">
        {children}

        {/* ---------------------------------------------- top-centre mode toggle */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center p-3 sm:p-4">
          <MapAnalyticsToggle
            mode={mode}
            onChange={(next) => navigate(next === 'analytics' ? '/analytics' : '/')}
            className="pointer-events-auto"
          />
        </div>

        {/* ------------------------------------ small screens: slide-over region rail */}
        <button
          type="button"
          onClick={() => setRailOpen(true)}
          className="chrome absolute right-3 top-3 z-30 flex items-center gap-1.5 px-2.5 py-1.5 text-2xs font-medium text-cream/80 hover:text-cream lg:hidden"
          aria-label="Show region list"
        >
          <PanelRight className="size-3.5" aria-hidden />
          Regions
          <span className="font-mono tabular-nums text-cream/55">{fields.length}</span>
        </button>

        {railOpen ? (
          <div className="absolute inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
              onClick={() => setRailOpen(false)}
              aria-hidden
            />
            <aside className="absolute inset-y-0 right-0 flex w-[320px] max-w-[86vw] flex-col gap-2.5 overflow-y-auto border-l border-border/60 bg-card/95 p-3">
              <button
                type="button"
                onClick={() => setRailOpen(false)}
                className="ml-auto flex items-center gap-1 text-2xs font-medium text-cream/60 hover:text-cream"
              >
                Close
                <X className="size-3.5" aria-hidden />
              </button>
              {rail}
            </aside>
          </div>
        ) : null}
      </div>

      {/* --------------------------------------------------- right: Region List rail */}
      <aside className="hidden w-[320px] shrink-0 flex-col gap-2.5 overflow-y-auto border-l border-border/60 bg-card/50 p-3 lg:flex">
        {rail}
      </aside>
    </div>
  );
}
