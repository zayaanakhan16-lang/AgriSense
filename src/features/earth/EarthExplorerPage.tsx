import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Database, X } from 'lucide-react';
import type { Field } from '@/types';
import { DrawingWorkspace } from '@/features/drawing/DrawingWorkspace';
import { SearchPanel } from '@/features/earth/SearchPanel';
import { RegionList } from '@/components/map/RegionList';
import { MapStatusBar } from '@/components/map/MapStatusBar';
import { AnalysisTransition } from '@/features/analysis/AnalysisTransition';
import { BASEMAPS, useMapStore, useSearchStore } from '@/store/mapStore';
import { useDrawStore } from '@/store/drawStore';
import { useFieldsStore } from '@/store/fieldsStore';
import { DATA_SOURCES } from '@/services/sources';


type Mode = 'explore' | 'analysis';

const SOURCE_PILLS = [
  { label: 'Basemap', value: 'Sentinel-2 (EOX)', source: DATA_SOURCES.satelliteImagery },
  { label: 'Vegetation', value: 'Sentinel-2 L2A', source: DATA_SOURCES.sentinelCogs },
  { label: 'Soil', value: 'SoilGrids v2.0', source: DATA_SOURCES.soilGrids },
  { label: 'Weather', value: 'Open-Meteo', source: DATA_SOURCES.openMeteoArchive },
];

export default function EarthExplorerPage(): JSX.Element {
  const [pendingField, setPendingField] = useState<Field | null>(null);
  const [mode, setMode] = useState<Mode>('explore');
  const searchOpen = useSearchStore((s) => s.open);
  const setSearchOpen = useSearchStore((s) => s.setOpen);
  const resetDraw = useDrawStore((s) => s.reset);
  const fields = useFieldsStore((s) => s.fields);
  const selectField = useFieldsStore((s) => s.selectField);
  const selectedFieldId = useFieldsStore((s) => s.selectedFieldId);
  const basemap = useMapStore((s) => s.basemap);

  const handleFieldCreated = useCallback((field: Field) => {
    setPendingField(field);
    setMode('analysis');
  }, []);

  const handleAnalysisCancel = useCallback(() => {
    setPendingField(null);
    setMode('explore');
    resetDraw();
  }, [resetDraw]);

  if (mode === 'analysis' && pendingField) {
    return (
      <AnalysisTransition
        field={pendingField}
        onComplete={() => {
          setMode('explore');
          setPendingField(null);
        }}
        onCancel={handleAnalysisCancel}
      />
    );
  }

  return (
    <div className="relative flex size-full min-h-0">
      <div className="relative min-w-0 flex-1">
        <DrawingWorkspace onFieldCreated={handleFieldCreated} onOpenSearch={() => setSearchOpen(true)} />

        {/* ------------------------------------------------ floating info rail */}
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden items-start justify-end p-4 md:flex">
          <AnimatePresence>
            {!searchOpen ? (
              <motion.div
                key="rail"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 18 }}
                transition={{ duration: 0.22 }}
                className="pointer-events-auto flex w-[272px] flex-col gap-2.5 pt-20"
              >
                <div className="chrome p-4">
                  <RegionList
                    fields={fields}
                    selectedFieldId={selectedFieldId}
                    onSelect={selectField}
                    onAddFarm={() => setSearchOpen(true)}
                  />
                </div>

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
                    Keyless and open-licensed. Crop rules run on a labelled demonstration dataset.
                  </p>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* ------------------------------------------------------ status bar */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 hidden justify-center p-4 md:flex">
          <MapStatusBar
            className="pointer-events-auto max-w-[900px]"
            fields={fields.length}
            basemapLabel={BASEMAPS[basemap]?.label ?? basemap}
            imageryLabel="Sentinel-2 cloudless (EOX)"
            selectedField={fields.find((f) => f.id === selectedFieldId) ?? null}
          />
        </div>

        {/* ---------------------------------------------------- search slide-over */}
        <AnimatePresence>
          {searchOpen ? (
            <motion.aside
              initial={{ x: 340, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 340, opacity: 0 }}
              transition={{ type: 'spring', damping: 34, stiffness: 340 }}
              className="absolute inset-y-0 right-0 z-30 w-full max-w-[360px] border-l border-border/70 bg-card shadow-float"
            >
              <SearchPanel />
            </motion.aside>
          ) : null}
        </AnimatePresence>

        {searchOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-20 bg-forest-950/50 backdrop-blur-[2px] md:hidden"
            onClick={() => setSearchOpen(false)}
            aria-label="Close search panel"
          >
            <X className="sr-only" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
