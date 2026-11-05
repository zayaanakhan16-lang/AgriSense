import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { Field } from '@/types';
import { DrawingWorkspace } from '@/features/drawing/DrawingWorkspace';
import { SearchPanel } from '@/features/earth/SearchPanel';
import { EarthWorkspace } from '@/features/earth/EarthWorkspace';
import { MapStatusBar } from '@/components/map/MapStatusBar';
import { AnalysisTransition } from '@/features/analysis/AnalysisTransition';
import { BASEMAPS, useMapStore, useSearchStore } from '@/store/mapStore';
import { useDrawStore } from '@/store/drawStore';
import { useFieldsStore } from '@/store/fieldsStore';
import { buildDemoRegion, DEMO_REGION_ID } from '@/data/regions';

type Mode = 'explore' | 'analysis';

export default function EarthExplorerPage(): JSX.Element {
  const [pendingField, setPendingField] = useState<Field | null>(null);
  const [mode, setMode] = useState<Mode>('explore');
  const searchOpen = useSearchStore((s) => s.open);
  const setSearchOpen = useSearchStore((s) => s.setOpen);
  const resetDraw = useDrawStore((s) => s.reset);
  const fields = useFieldsStore((s) => s.fields);
  const selectField = useFieldsStore((s) => s.selectField);
  const selectedFieldId = useFieldsStore((s) => s.selectedFieldId);
  const addField = useFieldsStore((s) => s.addField);
  const basemap = useMapStore((s) => s.basemap);
  const flyTo = useMapStore((s) => s.flyTo);

  // Seed the demonstration region once on a fresh workspace so the map, the
  // Region List and the analytics workspace have something to show. It is
  // clearly labelled as a sample everywhere it appears.
  useEffect(() => {
    if (fields.some((field) => field.id === DEMO_REGION_ID)) return;
    const demo = buildDemoRegion();
    addField(demo);
    selectField(demo.id);
    flyTo({ coord: demo.boundary.centroid, zoom: 15, bbox: demo.boundary.bbox });
    // Seed only on the first mount of an empty workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFieldCreated = useCallback(
    (field: Field) => {
      resetDraw();
      setPendingField(field);
      setMode('analysis');
    },
    [resetDraw],
  );

  const handleAnalysisCancel = useCallback(() => {
    setPendingField(null);
    setMode('explore');
    resetDraw();
  }, [resetDraw]);

  /** "New region" starts the drawing tool on the map. */
  const handleAddRegion = useCallback(() => {
    resetDraw();
    useDrawStore.getState().start();
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
    <EarthWorkspace mode="map" showSources onAddRegion={handleAddRegion}>
      <DrawingWorkspace onFieldCreated={handleFieldCreated} onOpenSearch={() => setSearchOpen(true)} />

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
    </EarthWorkspace>
  );
}
