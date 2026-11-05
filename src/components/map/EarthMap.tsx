import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  Compass,
  Globe2,
  Layers,
  LocateFixed,
  MapPin,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Satellite,
  Search,
} from 'lucide-react';
import type { CropZone, LngLat, NdviOverlayGeometry } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatArea, formatCoord, toDMS } from '@/lib/format';
import { BASEMAP_ORDER, useMapStore, type BasemapId } from '@/store/mapStore';
import { computeDrawMetrics, useDrawStore } from '@/store/drawStore';
import { availableBasemaps, isWebglAvailable, resolveBasemap, useEarthMap } from './earthMapSetup';
import { MapToolbar, type MapViewMode } from './MapToolbar';
import {
  installLayers,
  setDrawInteractivity,
  updateDrawLayer,
  updateFieldLayer,
  updateMarkerLayer,
  updateNdviLayer,
  updateVertexLayer,
  updateZoneLayer,
  LAYERS,
} from './layers';

export interface EarthMapProps {
  className?: string;
  fieldCoords?: LngLat[] | null;
  zones?: CropZone[];
  ndviOverlay?: NdviOverlayGeometry | null;
  markers?: Array<{ coord: LngLat; color: string; radius: number }>;
  drawing?: boolean;
  /** Enable drag-editing of polygon vertices. */
  editing?: boolean;
  /** Show the globe-appropriate chrome (search, layer switcher, locator). */
  globeMode?: boolean;
  /** Render the vertical left toolbar (layers, zoom, tools). */
  toolbar?: boolean;
  /** Show the bottom-left coordinate readout. */
  showCursorReadout?: boolean;
  onMapReady?: (map: MapLibreMap) => void;
  onSearchClick?: () => void;
  /** Invoked by the toolbar drawing tool. */
  onStartDraw?: () => void;
  /** Enter pressed while drawing. */
  onDrawConfirm?: () => void;
  /** Escape pressed while drawing. */
  onDrawCancel?: () => void;
  compact?: boolean;
}

export function EarthMap({
  className,
  fieldCoords,
  zones = [],
  ndviOverlay = null,
  markers = [],
  drawing = false,
  editing = false,
  globeMode = false,
  toolbar = false,
  showCursorReadout = true,
  onMapReady,
  onSearchClick,
  onStartDraw,
  onDrawConfirm,
  onDrawCancel,
  compact = false,
}: EarthMapProps): JSX.Element {
  const [viewMode, setViewMode] = useState<MapViewMode>('map');
  // A callback ref rather than useRef: the map must be created only once the
  // container is actually in the DOM, otherwise MapLibre mounts into a null node.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(() => !isWebglAvailable());
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
  const activeVertex = useDrawStore((s) => s.activeVertex);
  const addPoint = useDrawStore((s) => s.addPoint);
  const setDrawHover = useDrawStore((s) => s.setHover);
  const moveVertex = useDrawStore((s) => s.moveVertex);
  const setActiveVertex = useDrawStore((s) => s.setActiveVertex);
  const insertVertex = useDrawStore((s) => s.insertVertex);

  const handleReady = useCallback(
    (map: MapLibreMap) => {
      installLayers(map);
      setReady(true);
      onMapReady?.(map);
    },
    [onMapReady],
  );

  const handleFailure = useCallback(() => setFailed(true), []);

  const mapRef = useEarthMap({
    container,
    basemap,
    labelsVisible,
    globe: true,
    onReady: handleReady,
    onCursorMove: setCursor,
    onZoomChange: setZoom,
    onFailure: handleFailure,
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

  /* ------------------------------------------- keyboard: Enter save / Escape cancel */
  useEffect(() => {
    if (!drawing) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      // Never hijack typing inside the New Region dialog or any input.
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      // Also guard on the dialog's own open state: once the region dialog is up,
      // Escape should close the dialog, not discard the ring behind it.
      if (document.querySelector('[role="dialog"]')) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        onDrawConfirm?.();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onDrawCancel?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawing, onDrawConfirm, onDrawCancel]);

  /* ------------------------------------------------------ drag-to-edit vertices */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !editing) return;

    const canvas = map.getCanvas();

    const onEnter = (): void => {
      canvas.style.cursor = 'pointer';
    };
    const onLeave = (): void => {
      canvas.style.cursor = '';
    };
    const onDown = (event: maplibregl.MapLayerMouseEvent): void => {
      const index = Number(event.features?.[0]?.properties?.index);
      if (Number.isFinite(index)) {
        map.dragPan.disable();
        setActiveVertex(index);
        event.preventDefault();
      }
    };
    const onDragMove = (event: maplibregl.MapMouseEvent): void => {
      const index = useDrawStore.getState().activeVertex;
      if (index === null) return;
      moveVertex(index, { lng: event.lngLat.lng, lat: event.lngLat.lat });
    };
    const onUp = (): void => {
      if (useDrawStore.getState().activeVertex === null) return;
      setActiveVertex(null);
      map.dragPan.enable();
    };
    // Clicking a midpoint segment inserts a new vertex there.
    const onSegmentClick = (event: maplibregl.MapLayerMouseEvent): void => {
      if (useDrawStore.getState().activeVertex !== null) return;
      const after = Number(event.features?.[0]?.properties?.index);
      if (Number.isFinite(after)) insertVertex(after, { lng: event.lngLat.lng, lat: event.lngLat.lat });
    };

    map.on('mouseenter', LAYERS.vertices.layer, onEnter);
    map.on('mouseleave', LAYERS.vertices.layer, onLeave);
    map.on('mousedown', LAYERS.vertices.layer, onDown);
    map.on('mousemove', onDragMove);
    map.on('mouseup', onUp);
    map.on('click', LAYERS.vertices.layer, onSegmentClick);

    return () => {
      map.off('mouseenter', LAYERS.vertices.layer, onEnter);
      map.off('mouseleave', LAYERS.vertices.layer, onLeave);
      map.off('mousedown', LAYERS.vertices.layer, onDown);
      map.off('mousemove', onDragMove);
      map.off('mouseup', onUp);
      map.off('click', LAYERS.vertices.layer, onSegmentClick);
      canvas.style.cursor = '';
      map.dragPan.enable();
    };
  }, [mapRef, ready, editing, moveVertex, setActiveVertex, insertVertex]);

  /* ------------------------------------------------------- vertex handle layer */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!editing) {
      updateVertexLayer(map, null);
      return;
    }
    updateVertexLayer(
      map,
      drawPoints.map((coord, index) => ({ index, coord, active: index === activeVertex })),
    );
  }, [mapRef, ready, editing, drawPoints, activeVertex]);

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
    mapRef.current?.zoomTo(mapRef.current.getZoom() + delta, { duration: 320 });
  };
  const resetNorth = (): void => {
    mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 500 });
  };
  const locateMe = (): void => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        useMapStore.getState().flyTo({
          coord: { lng: position.coords.longitude, lat: position.coords.latitude },
          zoom: 15,
        });
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const metrics = useMemo(() => computeDrawMetrics(drawPoints), [drawPoints]);
  const currentBasemap = resolveBasemap(basemap);
  const basemaps = useMemo(() => availableBasemaps(), []);

  if (failed) {
    return <WebglFallback className={className} />;
  }

  return (
    <div className={cn('relative size-full overflow-hidden bg-forest-950', className)}>
      {/* Normal cursor by default; the pencil appears only while the draw tool
          is active, and the whole canvas still receives map pointer events. */}
      <div
        ref={setContainer}
        className={cn('absolute inset-0', drawing ? 'cursor-pencil-active' : 'cursor-grab active:cursor-grabbing')}
        aria-label="Interactive Earth map"
        role="application"
      />

      {/* ------------------------------------------------- top-left: brand + search */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          {onSearchClick ? (
            <button
              type="button"
              onClick={onSearchClick}
              className="group flex h-9 items-center gap-2 rounded-full border border-white/10 bg-forest-950/70 pl-3 pr-3.5 text-left text-[0.8125rem] text-cream/60 shadow-float backdrop-blur transition-colors hover:border-lime/30 hover:text-cream sm:min-w-[230px]"
            >
              <Search className="size-3.5 shrink-0 text-lime" aria-hidden />
              <span className="hidden flex-1 sm:inline">Search a farm, city or place</span>
              <span className="sm:hidden">Search</span>
            </button>
          ) : null}
          <div className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-forest-950/70 px-2.5 py-1.5 text-2xs text-cream/70 backdrop-blur md:flex">
            <Satellite className="size-3 text-lime" aria-hidden />
            <span className="font-medium text-cream/90">{currentBasemap.short}</span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="shell"
                size="icon-sm"
                className="size-9 rounded-full border border-white/10"
                onClick={resetToGlobe}
                aria-label="Return to the global Earth view"
              >
                <Globe2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Global Earth view</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="shell"
                size="icon-sm"
                className="size-9 rounded-full border border-white/10"
                onClick={resetNorth}
                aria-label="Reset orientation to north"
              >
                <Compass className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset orientation to north</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ------------------------------------------------- left: vertical toolbar
          (keeps the right edge free for the floating Region List) */}
      {toolbar ? (
        <MapToolbar
          className="absolute left-3 top-1/2 z-20 -translate-y-1/2 sm:left-4"
          basemap={basemap}
          basemaps={basemaps}
          onSelectBasemap={setBasemap}
          viewMode={viewMode}
          onToggleView={() => {
            setViewMode((mode) => {
              const next: MapViewMode = mode === 'map' ? 'navigation' : 'map';
              useMapStore.getState().setProjection(next === 'map' ? 'globe' : 'mercator');
              mapRef.current?.easeTo({ pitch: next === 'navigation' ? 55 : 0, bearing: 0, duration: 700 });
              return next;
            });
          }}
          onZoomIn={() => zoomBy(1)}
          onZoomOut={() => zoomBy(-1)}
          drawing={drawing}
          onStartDraw={() => onStartDraw?.()}
          onLocate={locateMe}
          labelsVisible={labelsVisible}
          onToggleLabels={toggleLabels}
          onResetNorth={resetNorth}
        />
      ) : (
        <div className="absolute left-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2 sm:left-4">
          <div className="flex flex-col overflow-hidden rounded-full border border-white/10 bg-forest-950/75 shadow-float backdrop-blur">
            <button
              type="button"
              onClick={() => zoomBy(1)}
              className="flex size-9 items-center justify-center text-cream/80 transition-colors hover:bg-white/10 hover:text-cream"
              aria-label="Zoom in"
            >
              <Plus className="size-4" />
            </button>
            <span className="mx-auto h-px w-5 bg-white/10" aria-hidden />
            <button
              type="button"
              onClick={() => zoomBy(-1)}
              className="flex size-9 items-center justify-center text-cream/80 transition-colors hover:bg-white/10 hover:text-cream"
              aria-label="Zoom out"
            >
              <Minus className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------- bottom-left: measurements */}
      <div className="absolute bottom-3 left-3 z-20 flex flex-col items-start gap-2 sm:bottom-4 sm:left-4">
        {drawing || drawPoints.length > 0 ? (
          <div className="chrome px-3 py-2">
            <div className="flex items-center gap-2 text-3xs uppercase tracking-[0.14em] text-lime">
              <span className="size-1.5 rounded-full bg-lime" aria-hidden />
              Drawing measurements
            </div>
            <div className="mt-1.5 flex items-baseline gap-3 font-mono text-xs text-cream">
              <span>
                <span className="text-cream/50">area </span>
                {metrics.areaM2 > 0 ? formatArea(metrics.areaM2) : '—'}
              </span>
              <span>
                <span className="text-cream/50">pts </span>
                {metrics.vertexCount}
              </span>
              <span>
                <span className="text-cream/50">perim </span>
                {metrics.perimeterM > 0 ? `${(metrics.perimeterM / 1000).toFixed(2)} km` : '—'}
              </span>
            </div>
          </div>
        ) : null}
        {showCursorReadout ? <CursorReadout /> : null}
      </div>

      {/* ------------------------------------------- bottom-right: layers + locate */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 sm:bottom-4 sm:right-4">
        {!toolbar ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleLabels}
                aria-label={labelsVisible ? 'Hide place labels' : 'Show place labels'}
                aria-pressed={labelsVisible}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full border shadow-float backdrop-blur transition-colors',
                  labelsVisible
                    ? 'border-lime/40 bg-lime/15 text-lime'
                    : 'border-white/10 bg-forest-950/75 text-cream/70 hover:text-cream',
                )}
              >
                <Layers className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{labelsVisible ? 'Hide labels' : 'Show labels'}</TooltipContent>
          </Tooltip>
        ) : null}

        {globeMode && !toolbar ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={locateMe}
                aria-label="Go to my location"
                className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-forest-950/75 text-cream/70 shadow-float backdrop-blur transition-colors hover:text-lime"
              >
                <LocateFixed className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>My location</TooltipContent>
          </Tooltip>
        ) : null}

        {!toolbar ? (
          <BasemapSwitcher
            current={basemap}
            onChange={(id) => setBasemap(id)}
            options={basemaps}
          />
        ) : null}
      </div>

      {!ready ? (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-forest-950">
          <div className="pointer-events-none absolute inset-0 graticule opacity-40" />
          <div className="relative flex flex-col items-center gap-3 text-cream/70">
            <div className="relative size-12">
              <span className="absolute inset-0 rounded-full border border-lime/20" />
              <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-lime" />
              <span className="absolute inset-3 rounded-full bg-lime/10" />
            </div>
            <p className="text-xs font-medium">Rendering Earth…</p>
            <p className="text-2xs text-cream/45">Keyless Sentinel-2 imagery via EOX</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BasemapSwitcher({
  current,
  onChange,
  options,
}: {
  current: BasemapId;
  onChange: (id: BasemapId) => void;
  options: ReturnType<typeof availableBasemaps>;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const active = options.find((o) => o.id === current);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choose map layer"
        className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-forest-950/75 pl-3 pr-2.5 text-[0.8125rem] font-medium text-cream shadow-float backdrop-blur transition-colors hover:border-lime/30"
      >
        <Layers className="size-3.5 text-lime" aria-hidden />
        <span className="hidden sm:inline">{active?.short}</span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close layer menu"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            className="chrome absolute bottom-11 right-0 z-50 w-[262px] overflow-hidden p-1.5"
          >
            {BASEMAP_ORDER.map((id) => {
              const option = options.find((o) => o.id === id);
              if (!option) return null;
              const selected = id === current;
              return (
                <li key={id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(id);
                      setOpen(false);
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
  );
}

function CursorReadout(): JSX.Element | null {
  const cursor = useMapStore((s) => s.cursor);
  const zoom = useMapStore((s) => s.zoom);
  if (!cursor) return null;
  return (
    <div className="chrome flex items-center gap-2 px-2.5 py-1.5 font-mono text-2xs text-cream/75">
      <MapPin className="size-3 text-lime" aria-hidden />
      <span className="tabular-nums">{formatCoord(cursor, 3)}</span>
      <span className="hidden text-cream/35 sm:inline">|</span>
      <span className="hidden tabular-nums sm:inline">{toDMS(cursor.lat, true)}</span>
      <span className="hidden tabular-nums sm:inline">{toDMS(cursor.lng, false)}</span>
      <span className="text-cream/35">|</span>
      <span className="tabular-nums text-lime">z{zoom.toFixed(1)}</span>
    </div>
  );
}

/** Graceful degradation when WebGL/globe rendering is unavailable. */
function WebglFallback({ className }: { className?: string }): JSX.Element {
  const basemap = useMapStore((s) => s.basemap);
  const setBasemap = useMapStore((s) => s.setBasemap);
  const definition = resolveBasemap(basemap);
  const tileUrl = definition.tiles[0]?.replace('{z}', '5').replace('{x}', '16').replace('{y}', '12');

  return (
    <div className={cn('relative flex size-full items-center justify-center overflow-hidden bg-forest-950', className)}>
      {tileUrl ? (
        <img
          src={tileUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover opacity-40"
          loading="lazy"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/70 to-forest-950/40" />
      <div className="relative max-w-md px-6 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-lime/30 bg-lime/10 text-lime">
          <Maximize2 className="size-5" />
        </div>
        <h2 className="font-display text-lg font-semibold text-cream">Interactive map unavailable</h2>
        <p className="mt-2 text-xs leading-relaxed text-cream/65">
          This browser or device cannot create a WebGL context, which MapLibre needs to render the 3D Earth. AgriSense
          has fallen back to a static satellite preview. All field drawing, analysis and planning still work — try the
          drawing workspace from a WebGL-capable browser for the full experience.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {(['satellite', 'openfreemap', 'terrain'] as BasemapId[]).map((id) => (
            <Button
              key={id}
              variant={basemap === id ? 'lime' : 'shell'}
              size="sm"
              className={cn(basemap !== id && 'border border-white/10')}
              onClick={() => setBasemap(id)}
            >
              <RotateCcw className="size-3.5" />
              {resolveBasemap(id).short}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
