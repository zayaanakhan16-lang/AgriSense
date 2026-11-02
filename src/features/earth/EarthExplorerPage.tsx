import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import type { Field } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DrawingWorkspace } from '@/features/drawing/DrawingWorkspace';
import { SearchPanel } from '@/features/earth/SearchPanel';
import { AnalysisTransition } from '@/features/analysis/AnalysisTransition';
import { useMapStore, useSearchStore } from '@/store/mapStore';
import { useDrawStore } from '@/store/drawStore';
import { useFieldsStore } from '@/store/fieldsStore';
import { HAS_MAPBOX_TOKEN } from '@/components/map/earthMapSetup';

type Mode = 'explore' | 'analysis';

export default function EarthExplorerPage(): JSX.Element {
  const [pendingField, setPendingField] = useState<Field | null>(null);
  const [mode, setMode] = useState<Mode>('explore');
  const searchOpen = useSearchStore((s) => s.open);
  const setSearchOpen = useSearchStore((s) => s.setOpen);
  const isGlobalView = useMapStore((s) => s.isGlobalView);
  const basemap = useMapStore((s) => s.basemap);
  const resetDraw = useDrawStore((s) => s.reset);
  const fieldsCount = useFieldsStore((s) => s.fields.length);

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
        <DrawingWorkspace onFieldCreated={handleFieldCreated} />

        {/* -------------------------------------------------- contextual side rail */}
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-start justify-end p-3 sm:p-4">
          <AnimatePresence>
            {!searchOpen ? (
              <motion.div
                key="rail"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.22 }}
                className="pointer-events-auto hidden w-[268px] flex-col gap-2.5 md:flex"
              >
                <div className="rounded-xl border border-white/10 bg-forest-950/82 p-3.5 shadow-float backdrop-blur">
                  <div className="flex items-center gap-2">
                    <Info className="size-3.5 text-lime" aria-hidden />
                    <h2 className="text-xs font-semibold text-cream">How to read this view</h2>
                  </div>
                  <Separator className="my-2.5 bg-white/10" />
                  <ol className="space-y-2 text-2xs leading-relaxed text-cream/70">
                    <li className="flex gap-2">
                      <span className="font-mono text-lime">1</span>
                      <span>Drag to rotate the globe. Scroll or pinch to zoom toward your region.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-mono text-lime">2</span>
                      <span>Select Draw Field to lock panning and switch the cursor to a pencil.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-mono text-lime">3</span>
                      <span>Click each corner of the farm. Triangles, rectangles and irregular boundaries all work.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-mono text-lime">4</span>
                      <span>Close the polygon to compute its geodesic area and start the analysis.</span>
                    </li>
                  </ol>
                </div>

                <div className="rounded-xl border border-white/10 bg-forest-950/82 p-3.5 shadow-float backdrop-blur">
                  <h2 className="text-xs font-semibold text-cream">Live data sources</h2>
                  <Separator className="my-2.5 bg-white/10" />
                  <ul className="space-y-2 text-2xs text-cream/70">
                    <li className="flex items-center justify-between gap-2">
                      <span>Basemap</span>
                      <Badge variant={HAS_MAPBOX_TOKEN ? 'lime' : 'muted'}>
                        {HAS_MAPBOX_TOKEN ? 'Mapbox' : 'Sentinel-2'}
                      </Badge>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Vegetation</span>
                      <Badge variant="lime">Sentinel-2 L2A</Badge>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Soil</span>
                      <Badge variant="lime">SoilGrids v2.0</Badge>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Climate</span>
                      <Badge variant="lime">Open-Meteo</Badge>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Crop rules</span>
                      <Badge variant="warning">Demo dataset</Badge>
                    </li>
                  </ul>
                  <p className="mt-2.5 text-[0.6875rem] leading-relaxed text-cream/50">
                    {isGlobalView
                      ? 'You are in the global Earth view. Zoom in to reach field scale.'
                      : `Viewing ${basemap.replace('-', ' ')} at field scale.`}
                  </p>
                </div>

                <Button
                  variant="shell"
                  size="sm"
                  className="border border-white/10"
                  onClick={() => setSearchOpen(true)}
                >
                  <PanelRightOpen className="size-3.5" />
                  Open location search
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* ------------------------------------------------------------ search panel */}
        <AnimatePresence>
          {searchOpen ? (
            <motion.aside
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="absolute inset-y-0 right-0 z-30 w-full max-w-[340px] border-l border-border/70 bg-card shadow-float"
            >
              <SearchPanel />
            </motion.aside>
          ) : null}
        </AnimatePresence>

        {!searchOpen ? (
          <Button
            variant="shell"
            size="icon-sm"
            className="absolute right-3 top-16 z-20 border border-white/10 md:hidden"
            onClick={() => setSearchOpen(true)}
            aria-label="Open location search"
          >
            <PanelRightClose className="size-3.5 rotate-180" />
          </Button>
        ) : null}
      </div>

      {/* --------------------------------------------------------- mobile hint strip */}
      <div className="sr-only" aria-live="polite">
        {fieldsCount > 0 ? `${fieldsCount} saved fields available.` : 'No saved fields yet.'}
      </div>

      {searchOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-forest-950/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setSearchOpen(false)}
          aria-label="Close search panel"
        >
          <X className="sr-only" />
        </button>
      ) : null}
    </div>
  );
}
