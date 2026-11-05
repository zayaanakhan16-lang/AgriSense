import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Globe2,
  Loader2,
  LocateFixed,
  Pencil,
  Ruler,
  Sparkles,
  Trash2,
  Undo2,
  XCircle,
} from 'lucide-react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Field } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InlineNotice } from '@/components/common/StateBlocks';
import { cn } from '@/lib/utils';
import { formatAcres, formatArea, formatCoord } from '@/lib/format';
import { useMapStore } from '@/store/mapStore';
import { closeRing, polygonAreaM2 } from '@/lib/geo';
import { useDrawStore } from '@/store/drawStore';
import { useFieldsStore } from '@/store/fieldsStore';
import { EarthMap } from '@/components/map/EarthMap';
import { RegionDialog, type RegionDraft } from '@/components/map/RegionDialog';

export interface DrawingWorkspaceProps {
  onFieldCreated: (field: Field) => void;
  onOpenSearch?: () => void;
}

export function DrawingWorkspace({ onFieldCreated, onOpenSearch }: DrawingWorkspaceProps): JSX.Element {
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const cursor = useMapStore((s) => s.cursor);
  const flyTo = useMapStore((s) => s.flyTo);
  const {
    mode,
    points,
    start,
    undo,
    cancel,
    close,
    reset,
    startEditing,
    finishEditing,
    removeVertex,
  } = useDrawStore();
  const createField = useFieldsStore((s) => s.createField);

  const drawing = mode === 'drawing';
  const editing = mode === 'editing';
  const closed = mode === 'closed';
  const idle = !drawing && !closed && !editing;

  const handleStart = useCallback(() => {
    reset();
    start();
    setValidationMessage(null);
    if (mapInstance && mapInstance.getZoom() < 12) {
      const center = mapInstance.getCenter();
      mapInstance.flyTo({ center, zoom: 15, duration: 1200 });
    }
  }, [mapInstance, reset, start]);

  const handleClose = useCallback(() => {
    if (points.length < 3) {
      setValidationMessage('Add at least three points to close the boundary.');
      return;
    }
    close();
    if (mapInstance && points.length >= 3) {
      const lngs = points.map((p) => p.lng);
      const lats = points.map((p) => p.lat);
      mapInstance.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 110, duration: 1100, maxZoom: 17 },
      );
    }
    setDialogOpen(true);
  }, [points, close, mapInstance]);

  /** Confirms the ring and opens the New Region dialog (Enter, or the button). */
  const handleConfirm = useCallback(() => {
    if (points.length < 3) {
      setValidationMessage('Add at least three points to close the boundary.');
      return;
    }
    handleClose();
  }, [points.length, handleClose]);

  /** Escape (or Cancel) discards the in-progress ring without saving. */
  const handleCancel = useCallback(() => {
    cancel();
    setValidationMessage(null);
    setDialogOpen(false);
  }, [cancel]);

  const handleRegionSubmit = useCallback(
    (draft: RegionDraft) => {
      const field = createField({
        name: draft.name,
        coords: points,
        locationLabel: cursor ? formatCoord(cursor, 3) : 'Drawn on the Earth globe',
        crop: draft.crop,
        regionType: draft.regionType,
        group: draft.group,
        color: draft.color,
      });
      onFieldCreated(field);
    },
    [points, cursor, createField, onFieldCreated],
  );

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) =>
        flyTo({ coord: { lng: position.coords.longitude, lat: position.coords.latitude }, zoom: 15 }),
      () => undefined,
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, [flyTo]);

  const ring = points.length >= 3 ? closeRing(points) : null;
  const area = ring ? polygonAreaM2(ring) : 0;

  return (
    <div className="relative size-full">
      <EarthMap
        drawing={drawing}
        editing={editing}
        globeMode
        toolbar
        onMapReady={setMapInstance}
        fieldCoords={closed || editing ? points : null}
        onSearchClick={onOpenSearch}
        onStartDraw={handleStart}
        onDrawConfirm={handleConfirm}
        onDrawCancel={handleCancel}
        className={cn(drawing && 'ring-2 ring-inset ring-lime/25')}
      />

      {/* ------------------------------------------------------------- idle HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center p-3 sm:p-5">
        <AnimatePresence mode="wait">
          {idle ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.26 }}
              className="pointer-events-auto mt-16 w-full max-w-[440px] sm:mt-20"
            >
              <div className="chrome overflow-hidden">
                <div className="flex items-start gap-3.5 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime/15 text-lime">
                    <Pencil className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="type-section text-cream">Draw a field on Earth</h2>
                    <p className="mt-1 text-2xs leading-relaxed text-cream/60">
                      Rotate the globe, zoom to your farm, then trace its boundary. Any shape works — the area is computed
                      geodesically the moment you close the ring.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] bg-black/20 px-4 py-3">
                  <Button variant="lime" size="sm" onClick={handleStart}>
                    <Pencil className="size-3.5" />
                    Draw field
                  </Button>
                  <Button
                    variant="shell"
                    size="sm"
                    className="border border-white/10"
                    onClick={() => {
                      const target = useMapStore.getState().view;
                      flyTo({ coord: target.center, zoom: 15 });
                    }}
                  >
                    <Globe2 className="size-3.5" />
                    Zoom to my area
                  </Button>
                  <Button variant="ghost" size="sm" className="text-cream/60 hover:bg-white/10 hover:text-cream" onClick={handleLocate}>
                    <LocateFixed className="size-3.5" />
                    My location
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* -------------------------------------------------------- drawing controls */}
      <AnimatePresence>
        {drawing ? (
          <motion.div
            key="drawing"
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 26 }}
            transition={{ duration: 0.24 }}
            className="absolute inset-x-0 bottom-0 z-30 p-3 sm:p-5"
          >
            <div className="chrome mx-auto flex max-w-3xl flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime/70" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-lime" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-cream">Drawing mode active</p>
                    <p className="text-2xs text-cream/55">
                      Click to place vertices, press <span className="font-mono text-cream/80">Enter</span> to save or{' '}
                      <span className="font-mono text-cream/80">Escape</span> to cancel. Panning is locked while drawing.
                    </p>
                  </div>
                </div>
                <Badge variant="lime" className="font-mono">
                  {points.length} {points.length === 1 ? 'point' : 'points'}
                </Badge>
              </div>

              <div className="hairline" />

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="lime" size="sm" onClick={handleClose} disabled={points.length < 3}>
                  <CheckCircle2 className="size-3.5" />
                  Close boundary
                </Button>
                <Button
                  variant="shell"
                  size="sm"
                  className="border border-white/10"
                  onClick={undo}
                  disabled={points.length === 0}
                >
                  <Undo2 className="size-3.5" />
                  Undo
                </Button>
                <Button variant="shell" size="sm" className="border border-white/10" onClick={handleCancel}>
                  <XCircle className="size-3.5" />
                  Cancel
                </Button>
                {points.length > 0 && points.length < 3 ? (
                  <span className="text-2xs text-cream/55">
                    {3 - points.length} more {3 - points.length === 1 ? 'point' : 'points'} needed.
                  </span>
                ) : null}
              </div>

              {validationMessage ? (
                <InlineNotice tone="warning">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="size-3.5" />
                    {validationMessage}
                  </span>
                </InlineNotice>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ----------------------------------------------------------- edit vertices */}
      <AnimatePresence>
        {editing ? (
          <motion.div
            key="editing"
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 26 }}
            transition={{ duration: 0.24 }}
            className="absolute inset-x-0 bottom-0 z-30 p-3 sm:p-5"
          >
            <div className="chrome mx-auto flex max-w-3xl flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-cream">Editing boundary</p>
                  <p className="text-2xs text-cream/55">
                    Drag a white handle to move a vertex. Click a handle to insert a new vertex after it.
                  </p>
                </div>
                <Badge variant="lime" className="font-mono">
                  {points.length} vertices
                </Badge>
              </div>
              <div className="hairline" />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="lime" size="sm" onClick={finishEditing}>
                  <Check className="size-3.5" />
                  Done editing
                </Button>
                <Button
                  variant="shell"
                  size="sm"
                  className="border border-white/10"
                  onClick={() => removeVertex(points.length - 1)}
                  disabled={points.length <= 3}
                >
                  <Undo2 className="size-3.5" />
                  Remove last vertex
                </Button>
                <Button variant="ghost" size="sm" className="text-cream/60 hover:bg-white/10 hover:text-cream" onClick={handleCancel}>
                  <XCircle className="size-3.5" />
                  Discard
                </Button>
              </div>
              <div className="flex items-baseline gap-4 font-mono text-xs text-cream">
                <span>
                  <span className="text-cream/50">area </span>
                  {formatArea(area)}
                </span>
                <span>
                  <span className="text-cream/50">acres </span>
                  {formatAcres(area)}
                </span>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ------------------------------------------------------- closed boundary HUD */}
      <AnimatePresence>
        {closed && !dialogOpen ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 26 }}
            transition={{ duration: 0.24 }}
            className="absolute inset-x-0 bottom-0 z-30 p-3 sm:p-5"
          >
            <div className="chrome mx-auto max-w-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-lime" />
                    <h2 className="type-section text-cream">Boundary closed</h2>
                  </div>
                  <p className="mt-1 text-2xs leading-relaxed text-cream/55">
                    Area is computed geodesically on the WGS84 ellipsoid, not on the projected screen.
                  </p>
                </div>
                <div className="flex gap-6">
                  <Metric label="Area" value={formatArea(area)} sub={formatAcres(area)} />
                  <Metric label="Vertices" value={String(points.length)} sub="ring closed" />
                </div>
              </div>

              {validationMessage ? (
                <InlineNotice tone="warning" className="mt-3">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="size-3.5" />
                    {validationMessage}
                  </span>
                </InlineNotice>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="lime" onClick={() => setDialogOpen(true)}>
                  <Sparkles className="size-4" />
                  Save region
                </Button>
                <Button variant="shell" className="border border-white/10" onClick={startEditing}>
                  <Pencil className="size-3.5" />
                  Edit vertices
                </Button>
                <Button variant="shell" className="border border-white/10" onClick={handleCancel}>
                  <ArrowLeft className="size-3.5" />
                  Redraw
                </Button>
                <Button
                  variant="ghost"
                  className="text-cream/60 hover:bg-white/10 hover:text-cream"
                  onClick={() => {
                    handleCancel();
                    reset();
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Discard
                </Button>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-2xs text-cream/45">
                <Ruler className="size-3" aria-hidden />
                {cursor ? `Cursor at ${formatCoord(cursor, 4)}` : 'Move the cursor over the map to read coordinates.'}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ---------------------------------------------------------- New Region dialog */}
      <RegionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        areaM2={area}
        locationLabel={cursor ? formatCoord(cursor, 3) : 'Drawn on the Earth globe'}
        onSubmit={handleRegionSubmit}
      />

      {/* ------------------------------------------------------- drawing ambience */}
      {drawing ? (
        <>
          <div className="pointer-events-none absolute inset-0 z-10">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-lime/[0.08] to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-lime/[0.08] to-transparent" />
          </div>
          <div className="pointer-events-none absolute right-4 top-1/2 z-20 -translate-y-1/2">
            <div className="chrome flex items-center gap-2 px-3 py-1.5 text-2xs text-lime">
              <Loader2 className="size-3 animate-pulse" />
              Pencil active
            </div>
          </div>
        </>
      ) : null}

      {closed ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 hidden -translate-x-1/2 sm:block">
          <div className="chrome flex items-center gap-2 px-3 py-1.5 text-2xs text-cream/70">
            <Check className="size-3 text-lime" />
            Review the boundary, then name and analyse it
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }): JSX.Element {
  return (
    <div>
      <div className="label-caps text-cream/50">{label}</div>
      <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-cream">{value}</div>
      <div className="text-2xs text-cream/45">{sub}</div>
    </div>
  );
}
