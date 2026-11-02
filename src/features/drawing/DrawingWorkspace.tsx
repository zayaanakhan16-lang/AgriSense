import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Globe2,
  Loader2,
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
import { Separator } from '@/components/ui/separator';
import { InlineNotice } from '@/components/common/StateBlocks';
import { cn } from '@/lib/utils';
import { formatAcres, formatArea, formatCoord } from '@/lib/format';
import { useMapStore } from '@/store/mapStore';
import { closeRing, polygonAreaM2 } from '@/lib/geo';
import { useDrawStore } from '@/store/drawStore';
import { useFieldsStore } from '@/store/fieldsStore';
import { EarthMap } from '@/components/map/EarthMap';

export interface DrawingWorkspaceProps {
  onFieldCreated: (field: Field) => void;
}

export function DrawingWorkspace({ onFieldCreated }: DrawingWorkspaceProps): JSX.Element {
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [fieldName, setFieldName] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const cursor = useMapStore((s) => s.cursor);
  const flyTo = useMapStore((s) => s.flyTo);
  const { mode, points, start, undo, cancel, close, reset } = useDrawStore();
  const createField = useFieldsStore((s) => s.createField);

  const drawing = mode === 'drawing';
  const closed = mode === 'closed';

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
        { padding: 90, duration: 1100, maxZoom: 17 },
      );
    }
  }, [points, close, mapInstance]);

  const handleSave = useCallback(() => {
    const trimmed = fieldName.trim();
    if (!trimmed) {
      setValidationMessage('Give the field a name before continuing.');
      return;
    }
    const field = createField({
      name: trimmed,
      coords: points,
      locationLabel: cursor ? formatCoord(cursor, 3) : 'Drawn on the Earth globe',
    });
    onFieldCreated(field);
  }, [fieldName, points, cursor, createField, onFieldCreated]);

  const handleCancel = useCallback(() => {
    cancel();
    setValidationMessage(null);
    setFieldName('');
  }, [cancel]);

  return (
    <div className="relative size-full">
      <EarthMap
        drawing={drawing}
        onMapReady={setMapInstance}
        fieldCoords={closed ? points : null}
        className={cn(drawing && 'ring-2 ring-inset ring-lime/25')}
      />

      {/* ------------------------------------------------------------------ HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center p-3 sm:p-5">
        <AnimatePresence mode="wait">
          {!drawing && !closed ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="pointer-events-auto w-full max-w-md rounded-xl border border-white/10 bg-forest-950/85 p-4 shadow-float backdrop-blur"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lime/15 text-lime">
                  <Pencil className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-sm font-semibold text-cream">Draw a field on Earth</h2>
                  <p className="mt-1 text-2xs leading-relaxed text-cream/70">
                    Navigate to your farm, then trace its boundary. Triangles, rectangles and irregular shapes all work.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="lime" size="sm" onClick={handleStart}>
                      <Pencil className="size-3.5" />
                      Draw Field
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
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* ------------------------------------------------------- drawing controls */}
      <AnimatePresence>
        {drawing ? (
          <motion.div
            key="drawing"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.24 }}
            className="absolute inset-x-0 bottom-0 z-30 p-3 sm:p-5"
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-lime/25 bg-forest-950/90 p-4 shadow-float backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime/70" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-lime" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-cream">Drawing mode active</p>
                    <p className="text-2xs text-cream/60">
                      Click to place vertices. Panning is locked so the camera stays over your field.
                    </p>
                  </div>
                </div>
                <Badge variant="lime" className="font-mono">
                  {points.length} {points.length === 1 ? 'point' : 'points'}
                </Badge>
              </div>

              <Separator className="bg-white/10" />

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
                  Undo point
                </Button>
                <Button variant="shell" size="sm" className="border border-white/10" onClick={handleCancel}>
                  <XCircle className="size-3.5" />
                  Cancel
                </Button>
                {points.length > 0 && points.length < 3 ? (
                  <span className="text-2xs text-cream/60">
                    {3 - points.length} more {3 - points.length === 1 ? 'point' : 'points'} needed to form a polygon.
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

      {/* -------------------------------------------------------- confirm & name */}
      <AnimatePresence>
        {closed ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.24 }}
            className="absolute inset-x-0 bottom-0 z-30 p-3 sm:p-5"
          >
            <div className="mx-auto max-w-2xl rounded-xl border border-lime/25 bg-forest-950/92 p-5 shadow-float backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-lime" />
                    <h2 className="font-display text-sm font-semibold text-cream">Boundary closed</h2>
                  </div>
                  <p className="mt-1 text-2xs text-cream/65">
                    Area is computed geodesically on the WGS84 ellipsoid, not on the projected screen.
                  </p>
                </div>
                <div className="flex gap-6">
                  <Metric label="Area" value={formatArea(polygonAreaM2(closeRing(points)))} sub={formatAcres(polygonAreaM2(closeRing(points)))} />
                  <Metric label="Vertices" value={String(points.length)} sub="ring closed" />
                </div>
              </div>

              <Separator className="my-4 bg-white/10" />

              <label className="block">
                <span className="label-caps text-cream/60">Field name</span>
                <input
                  value={fieldName}
                  onChange={(event) => {
                    setFieldName(event.target.value);
                    setValidationMessage(null);
                  }}
                  placeholder="e.g. North pivot — wheat block"
                  className="mt-2 w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-cream placeholder:text-cream/40 focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/40"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleSave();
                  }}
                  autoFocus
                />
              </label>

              {validationMessage ? (
                <InlineNotice tone="warning" className="mt-3">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="size-3.5" />
                    {validationMessage}
                  </span>
                </InlineNotice>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="lime" onClick={handleSave}>
                  <Sparkles className="size-4" />
                  Analyse this field
                </Button>
                <Button variant="shell" className="border border-white/10" onClick={handleCancel}>
                  <ArrowLeft className="size-3.5" />
                  Back to editing
                </Button>
                <Button variant="ghost" className="text-cream/70 hover:bg-white/10 hover:text-cream" onClick={handleCancel}>
                  <Trash2 className="size-3.5" />
                  Discard
                </Button>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-2xs text-cream/50">
                <Ruler className="size-3" aria-hidden />
                {cursor ? `Cursor at ${formatCoord(cursor, 4)}` : 'Move the cursor over the map to read coordinates.'}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {drawing ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-lime/[0.07] to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-lime/[0.07] to-transparent" />
        </div>
      ) : null}

      {drawing ? (
        <div className="pointer-events-none absolute right-4 top-1/2 z-20 -translate-y-1/2">
          <div className="flex items-center gap-2 rounded-full border border-lime/30 bg-forest-950/80 px-3 py-1.5 text-2xs text-lime backdrop-blur">
            <Loader2 className="size-3 animate-pulse" />
            Pencil active
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }): JSX.Element {
  return (
    <div>
      <div className="label-caps text-cream/55">{label}</div>
      <div className="mt-0.5 font-mono text-lg font-semibold text-cream">{value}</div>
      <div className="text-2xs text-cream/50">{sub}</div>
    </div>
  );
}

