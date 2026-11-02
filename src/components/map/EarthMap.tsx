import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { Layers, MapPin, Navigation, RotateCcw, Ruler, Satellite, Search, ZoomIn, ZoomOut } from 'lucide-react';
import type { CropZone, LngLat, NdviOverlayGeometry } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatArea, formatCoord, toDMS } from '@/lib/format';
import { useMapStore, type BasemapId } from '@/store/mapStore';
import { computeDrawMetrics, useDrawStore } from '@/store/drawStore';
import { availableBasemaps, useEarthMap } from './earthMapSetup';
import {
  installLayers,
  setDrawInteractivity,
  updateDrawLayer,
  updateFieldLayer,
  updateMarkerLayer,
  updateNdviLayer,
  updateZoneLayer,
} from './layers';

export interface EarthMapProps {
  className?: string;
  fieldCoords?: LngLat[] | null;
  zones?: CropZone[];
  ndviOverlay?: NdviOverlayGeometry | null;
  markers?: Array<{ coord: LngLat; color: string; radius: number }>;
  drawing?: boolean;
  onMapReady?: (map: MapLibreMap) => void;
  onSearchClick?: () => void;
  compact?: boolean;
}

export function EarthMap({
  className,
  fieldCoords,
  zones = [],
  ndviOverlay = null,
  markers = [],
  drawing = false,
  onMapReady,
  onSearchClick,
  compact = false,
}: EarthMapProps): JSX.Element {
  // A callback ref rather than useRef: the map must be created only once the
  // container is actually in the DOM, otherwise MapLibre mounts into a null node.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const basemap = useMapStore((s) => s.basemap);
  const labelsVisible = useMapStore((s) => s.labelsVisible);
  const setBasemap = useMapStore((s) => s.setBasemap);
  const toggleLabels = useMapStore((s) => s.toggleLabels);
  const setCursor = useMapStore((s) => s.setCursor);
  const setZoom = useMapStore((s) => s.setZoom);
  const resetToGlobe = useMapStore((s) => s.resetToGlobe);

  const drawPoints = useDrawStore((s) => s.points);
  const drawHover = useDrawStore((s) => s.hover);
  const drawMode = useDrawStore((s) => s.mode);
  const addPoint = useDrawStore((s) => s.addPoint);
  const setDrawHover = useDrawStore((s) => s.setHover);

  const handleReady = useCallback(
    (map: MapLibreMap) => {
      installLayers(map);
      setReady(true);
      onMapReady?.(map);
    },
    [onMapReady],
  );

  const mapRef = useEarthMap({
    container,
    basemap,
    labelsVisible,
    onReady: handleReady,
    onCursorMove: setCursor,
    onZoomChange: setZoom,
  });

  /* ------------------------------------------------------------ click to draw */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !drawing) return;

    const handleClick = (event: maplibregl.MapMouseEvent): void => {
      addPoint({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    };
    const handleMove = (event: maplibregl.MapMouseEvent): void => {
      setDrawHover({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    };
    const handleLeave = (): void => setDrawHover(null);

    map.on('click', handleClick);
    map.on('mousemove', handleMove);
    map.on('mouseout', handleLeave);
    return () => {
      map.off('click', handleClick);
      map.off('mousemove', handleMove);
      map.off('mouseout', handleLeave);
    };
  }, [mapRef, ready, drawing, addPoint, setDrawHover]);

  /* --------------------------------------------------------- pan lock while drawing */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    setDrawInteractivity(map, drawing);
  }, [mapRef, ready, drawing]);

  /* ---------------------------------------------------------------- layer updates */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    updateFieldLayer(map, fieldCoords ?? null);
  }, [mapRef, ready, fieldCoords]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    updateDrawLayer(map, { points: drawPoints, hover: drawHover, closed: drawMode === 'closed' });
  }, [mapRef, ready, drawPoints, drawHover, drawMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    updateZoneLayer(map, zones);
  }, [mapRef, ready, zones]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    updateNdviLayer(map, ndviOverlay);
  }, [mapRef, ready, ndviOverlay]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    updateMarkerLayer(map, markers);
  }, [mapRef, ready, markers]);

  /* ------------------------------------------------------------------ fly-to */
  const flyToTarget = useMapStore((s) => s.flyToTarget);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !flyToTarget) return;
    if (flyToTarget.bbox) {
      map.fitBounds(
        [
          [flyToTarget.bbox[0], flyToTarget.bbox[1]],
          [flyToTarget.bbox[2], flyToTarget.bbox[3]],
        ],
        { padding: compact ? 40 : 120, duration: 1600, maxZoom: flyToTarget.zoom ?? 16, pitch: 0 },
      );
      return;
    }
    map.flyTo({
      center: [flyToTarget.coord.lng, flyToTarget.coord.lat],
      zoom: flyToTarget.zoom ?? 14,
      pitch: flyToTarget.zoom && flyToTarget.zoom > 8 ? 45 : 0,
      bearing: 0,
      duration: 1800,
      essential: true,
    });
  }, [mapRef, ready, flyToTarget, compact]);

  /* ------------------------------------------------------------------ controls */
  const zoomBy = (delta: number): void => {
    const map = mapRef.current;
    if (!map) return;
    map.zoomTo(map.getZoom() + delta, { duration: 320 });
  };
  const resetNorth = (): void => {
    mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 500 });
  };
  const metrics = useMemo(() => computeDrawMetrics(drawPoints), [drawPoints]);
  const basemaps = useMemo(() => availableBasemaps(), []);

  return (
    <div className={cn('relative size-full overflow-hidden bg-forest-950', className)}>
      <div
        ref={setContainer}
        className={cn(
          'absolute inset-0',
          drawing ? 'cursor-pencil-active' : 'cursor-crosshair',
        )}
        aria-label="Interactive Earth map"
        role="application"
      />

      {/* ------------------------------------------------------- top-left controls */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          {onSearchClick ? (
            <Button
              variant="shell"
              size="sm"
              onClick={onSearchClick}
              className="border border-white/10 shadow-float"
              aria-label="Search for a location"
            >
              <Search className="size-3.5" />
              <span className="hidden sm:inline">Search location</span>
            </Button>
          ) : null}
          <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-forest-950/70 px-2.5 py-1.5 text-2xs text-cream/70 backdrop-blur sm:flex">
            <Satellite className="size-3 text-lime" aria-hidden />
            <span className="font-medium text-cream/90">{basemaps.find((b) => b.id === basemap)?.label}</span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="shell"
                size="icon-sm"
                className="border border-white/10"
                onClick={resetToGlobe}
                aria-label="Return to the global Earth view"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Return to the global Earth view</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="shell"
                size="icon-sm"
                className="border border-white/10"
                onClick={resetNorth}
                aria-label="Reset map orientation to north"
              >
                <Navigation className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset orientation to north</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ------------------------------------------------------ right-side controls */}
      <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2 sm:right-4">
        <div className="flex flex-col overflow-hidden rounded-lg border border-white/10 bg-forest-950/75 shadow-float backdrop-blur">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => zoomBy(1)}
                className="flex size-8 items-center justify-center text-cream/80 transition-colors hover:bg-white/10 hover:text-cream"
                aria-label="Zoom in"
              >
                <ZoomIn className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Zoom in</TooltipContent>
          </Tooltip>
          <Separator className="bg-white/10" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => zoomBy(-1)}
                className="flex size-8 items-center justify-center text-cream/80 transition-colors hover:bg-white/10 hover:text-cream"
                aria-label="Zoom out"
              >
                <ZoomOut className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Zoom out</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ------------------------------------------------------ bottom-left readout */}
      <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-2 sm:bottom-4 sm:left-4">
        {drawing || drawPoints.length > 0 ? (
          <div className="rounded-lg border border-lime/30 bg-forest-950/85 px-3 py-2 shadow-float backdrop-blur">
            <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.12em] text-lime">
              <Ruler className="size-3" aria-hidden />
              Drawing measurements
            </div>
            <div className="mt-1.5 flex items-baseline gap-3 font-mono text-xs text-cream">
              <span>
                <span className="text-cream/55">area </span>
                {metrics.areaM2 > 0 ? formatArea(metrics.areaM2) : '—'}
              </span>
              <span>
                <span className="text-cream/55">pts </span>
                {metrics.vertexCount}
              </span>
              <span>
                <span className="text-cream/55">perimeter </span>
                {metrics.perimeterM > 0 ? `${(metrics.perimeterM / 1000).toFixed(2)} km` : '—'}
              </span>
            </div>
          </div>
        ) : null}
        <CursorReadout />
      </div>

      {/* --------------------------------------------------------- basemap selector */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 sm:bottom-4 sm:right-4">
        <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-forest-950/80 px-2.5 py-1.5 backdrop-blur lg:flex">
          <Layers className="size-3.5 text-lime" aria-hidden />
          <span className="text-2xs text-cream/70">Labels</span>
          <Switch
            checked={labelsVisible}
            onCheckedChange={toggleLabels}
            aria-label="Toggle place labels"
            className="scale-75"
          />
        </div>
        <Select value={basemap} onValueChange={(value) => setBasemap(value as BasemapId)}>
          <SelectTrigger className="h-8 w-[190px] border-white/10 bg-forest-950/80 text-xs text-cream backdrop-blur">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {basemaps.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                <span className="flex flex-col">
                  <span className="text-xs font-medium">{option.label}</span>
                  <span className="text-2xs text-muted-foreground">{option.description}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!ready ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-forest-950">
          <div className="flex flex-col items-center gap-3 text-cream/70">
            <div className="relative size-10">
              <span className="absolute inset-0 rounded-full border-2 border-lime/25" />
              <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-lime" />
            </div>
            <p className="text-xs">Initialising Earth renderer…</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CursorReadout(): JSX.Element | null {
  const cursor = useMapStore((s) => s.cursor);
  const zoom = useMapStore((s) => s.zoom);
  if (!cursor) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-forest-950/75 px-2.5 py-1.5 font-mono text-2xs text-cream/75 backdrop-blur">
      <MapPin className="size-3 text-lime" aria-hidden />
      <span className="tabular-nums">{formatCoord(cursor, 4)}</span>
      <span className="text-cream/40">|</span>
      <span className="tabular-nums">{toDMS(cursor.lat, true)}</span>
      <span className="tabular-nums">{toDMS(cursor.lng, false)}</span>
      <span className="text-cream/40">|</span>
      <Badge variant="lime" className="px-1.5 py-0 font-mono text-[0.625rem] normal-case">
        z{zoom.toFixed(1)}
      </Badge>
    </div>
  );
}
