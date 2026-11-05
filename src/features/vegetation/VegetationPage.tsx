import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, ImageOff, Layers, Satellite, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { NoFieldSelected } from '@/components/common/FieldContextBar';
import { DataOriginBadge, InlineNotice, SourceNote, UnavailableState } from '@/components/common/StateBlocks';
import {
  AnalysisErrorBanner,
  FieldHeaderCard,
  MetricTile,
  PageScaffold,
  SectionCard,
  SkeletonPanel,
} from '@/components/layout/PageScaffold';
import { EarthMap } from '@/components/map/EarthMap';
import { BarSeriesChart } from '@/components/charts/Charts';
import { NDVI_BANDS, ndviBandFor } from '@/services/satellite/colorRamp';
import { effectiveGroundSampleM } from '@/services/satellite/ndvi';
import { sourceWithRetrieval } from '@/services/sources';
import { formatDate, formatDateTime, formatNumber, percent } from '@/lib/format';
import { useFieldIntelligence } from '@/hooks/useFieldIntelligence';
import { cn } from '@/lib/utils';

export default function VegetationPage(): JSX.Element {
  const { field, intelligence, stages, running, completed, error, analysedAt, run } = useFieldIntelligence();
  const { vegetation, vegetationError } = intelligence;
  const [showOverlay, setShowOverlay] = useState(true);

  const distribution = useMemo(() => {
    if (!vegetation) return [];
    return NDVI_BANDS.filter((band) => band.id !== 'nodata').map((band) => ({
      band: band.label.split(' ')[0],
      share: Number((vegetation.stats.bands[band.id] * 100).toFixed(1)),
      color: band.color,
    }));
  }, [vegetation]);

  const gridImage = useMemo(() => {
    if (!vegetation) return null;
    return { cols: vegetation.grid.width, rows: vegetation.grid.height, values: vegetation.grid.values };
  }, [vegetation]);

  if (!field) {
    return (
      <PageScaffold
        title="Vegetation & NDVI"
        description="Sentinel-2 derived vegetation vigour, stress detection and acquisition metadata."
      >
        <NoFieldSelected />
      </PageScaffold>
    );
  }

  const band = vegetation ? ndviBandFor(vegetation.stats.mean) : null;
  const change = vegetation?.change ?? null;

  return (
    <PageScaffold
      title="Vegetation & NDVI"
      description="Vegetation index computed client-side from Sentinel-2 L2A red and near-infrared surface reflectance."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={run} disabled={running}>
            Refresh imagery
          </Button>
          <Button asChild variant="lime" size="sm">
            <Link to="/crops">
              <Sprout className="size-3.5" />
              Crop planning
            </Link>
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-4 sm:p-6">
        <FieldHeaderCard field={field} analysedAt={analysedAt} onRefresh={run} refreshing={running} stages={stages} />

        {error ? <AnalysisErrorBanner message={error} onRetry={run} /> : null}

        {running && !vegetation ? (
          <SectionCard title="Computing vegetation index">
            <SkeletonPanel rows={5} />
            <p className="mt-3 text-2xs text-muted-foreground">
              Reading red and near-infrared COG windows over HTTP range requests and evaluating NDVI per pixel inside the
              drawn boundary.
            </p>
          </SectionCard>
        ) : null}

        {vegetationError && !vegetation ? (
          <UnavailableState
            title="Vegetation index unavailable"
            message={vegetationError}
            source={sourceWithRetrieval('sentinelCogs').label}
          />
        ) : null}

        {vegetation ? (
          <>
            {/* --------------------------------------------------------- headline */}
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <MetricTile
                label="Mean NDVI"
                value={vegetation.stats.mean.toFixed(3)}
                sub={band?.label}
                tone="positive"
              />
              <MetricTile
                label="Median NDVI"
                value={vegetation.stats.median.toFixed(3)}
                sub={`P10 ${vegetation.stats.p10.toFixed(2)} · P90 ${vegetation.stats.p90.toFixed(2)}`}
              />
              <MetricTile
                label="Range"
                value={`${vegetation.stats.min.toFixed(2)} – ${vegetation.stats.max.toFixed(2)}`}
                sub={`${vegetation.stats.validPixels} valid pixels`}
              />
              <MetricTile
                label="Change vs previous scene"
                value={change ? `${change.delta >= 0 ? '+' : ''}${change.delta.toFixed(3)}` : '—'}
                sub={change ? `compared with ${formatDate(change.previousDate)}` : 'no comparable previous scene'}
                tone={change ? (change.delta >= 0 ? 'positive' : 'warning') : 'muted'}
              />
            </div>

            {/* ------------------------------------------------- map + legend grid */}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <SectionCard
                title="NDVI map layer"
                description="Per-pixel vegetation index rendered inside the drawn boundary."
                bodyClassName="p-0"
                actions={
                  <div className="flex items-center gap-2">
                    <Layers className="size-3.5 text-lime" aria-hidden />
                    <span className="text-2xs text-muted-foreground">NDVI overlay</span>
                    <Switch
                      checked={showOverlay}
                      onCheckedChange={setShowOverlay}
                      aria-label="Toggle NDVI overlay"
                      className="scale-90"
                    />
                  </div>
                }
              >
                <div className="relative h-[340px] overflow-hidden border-y border-border/60 sm:h-[420px]">
                  <EarthMap
                    fieldCoords={field.boundary.coords}
                    ndviOverlay={showOverlay ? vegetation.overlay : null}
                    compact
                    className="size-full"
                  />
                  {showOverlay ? (
                    <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-lg border border-white/10 bg-forest-950/88 p-3 shadow-float backdrop-blur">
                      <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-cream/75">
                        NDVI legend
                      </p>
                      <ul className="space-y-1">
                        {NDVI_BANDS.map((entry) => (
                          <li key={entry.id} className="flex items-center gap-2 text-2xs text-cream/80">
                            <span
                              className="size-2.5 rounded-sm border border-white/15"
                              style={{ background: entry.color }}
                              aria-hidden
                            />
                            <span className="min-w-[3.6rem]">{entry.label.split(' ')[0]}</span>
                            <span className="font-mono text-cream/55">
                              {entry.id === 'stressed' ? '< 0.20' : entry.id === 'healthy' ? '≥ 0.65' : `${entry.range[0]}–${entry.range[1]}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <SourceNote source={sourceWithRetrieval('sentinelCogs')} />
                  <span className="font-mono text-2xs text-muted-foreground">
                    ≈{formatNumber(effectiveGroundSampleM(vegetation, field.boundary.bbox), 1)} m per sampled cell
                  </span>
                </div>
              </SectionCard>

              <div className="space-y-4">
                <SectionCard title="Acquisition metadata" description="The exact scene used for this computation.">
                  <dl className="space-y-3 text-xs">
                    <Row label="Scene ID" value={vegetation.item.id} mono />
                    <Row label="Platform" value={vegetation.item.platform} />
                    <Row label="Acquired" value={formatDateTime(vegetation.item.datetime)} />
                    <Row label="Cloud cover" value={`${vegetation.item.cloudCover.toFixed(2)}%`} mono />
                    <Row label="MGRS tile" value={vegetation.item.tileId} mono />
                    <Row label="Collection" value={vegetation.item.collection} mono />
                    <Row label="Bands used" value="B04 (red) · B08 (NIR)" mono />
                  </dl>
                  <Separator className="my-3.5" />
                  <SourceNote source={sourceWithRetrieval('sentinelCatalog')} />
                </SectionCard>

                <SectionCard title="Vegetation health distribution" description="Share of valid pixels in each health band.">
                  <BarSeriesChart
                    data={distribution}
                    xKey="band"
                    series={[{ key: 'share', name: 'Share of field', color: '#9edb02' }]}
                    height={170}
                    formatValue={(value) => `${value.toFixed(1)}%`}
                  />
                  <ul className="mt-3 space-y-1.5">
                    {NDVI_BANDS.filter((entry) => entry.id !== 'nodata').map((entry) => (
                      <li key={entry.id} className="flex items-center gap-2 text-2xs">
                        <span className="size-2.5 rounded-sm" style={{ background: entry.color }} aria-hidden />
                        <span className="text-muted-foreground">{entry.label}</span>
                        <span className="ml-auto font-mono tabular-nums">
                          {percent(vegetation.stats.bands[entry.id], 1)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              </div>
            </div>

            {/* -------------------------------------------------- anomalies & legend */}
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard
                title="Vegetation anomalies"
                description="Bands that depart from a healthy canopy for this field."
              >
                <ul className="space-y-2">
                  {vegetation.stats.bands.stressed > 0.02 ? (
                    <AnomalyRow
                      tone="danger"
                      label="Severely stressed or bare pixels"
                      detail={`${percent(vegetation.stats.bands.stressed, 1)} of the field reads below NDVI 0.20 — bare soil, senescent canopy or a failed patch.`}
                    />
                  ) : null}
                  {vegetation.stats.bands.poor > 0.15 ? (
                    <AnomalyRow
                      tone="warning"
                      label="Sparse canopy concentration"
                      detail={`${percent(vegetation.stats.bands.poor, 1)} of the field sits between NDVI 0.20 and 0.35, indicating low canopy cover.`}
                    />
                  ) : null}
                  {change && change.delta < -0.04 ? (
                    <AnomalyRow
                      tone="warning"
                      label="Declining vigour"
                      detail={`Mean NDVI fell ${Math.abs(change.delta).toFixed(3)} since ${formatDate(change.previousDate)}. Investigate water, nutrient or pest pressure.`}
                    />
                  ) : null}
                  {change && change.delta > 0.04 ? (
                    <AnomalyRow
                      tone="positive"
                      label="Improving vigour"
                      detail={`Mean NDVI rose ${change.delta.toFixed(3)} since ${formatDate(change.previousDate)}.`}
                    />
                  ) : null}
                  {vegetation.stats.p90 - vegetation.stats.p10 > 0.25 ? (
                    <AnomalyRow
                      tone="warning"
                      label="High within-field variability"
                      detail={`The 10th–90th percentile spread is ${(vegetation.stats.p90 - vegetation.stats.p10).toFixed(3)}, indicating uneven growth across the boundary.`}
                    />
                  ) : null}
                  {vegetation.stats.bands.stressed <= 0.02 &&
                  vegetation.stats.bands.poor <= 0.15 &&
                  (!change || Math.abs(change.delta) <= 0.04) &&
                  vegetation.stats.p90 - vegetation.stats.p10 <= 0.25 ? (
                    <li className="rounded-lg border border-lime/25 bg-lime/[0.06] px-3.5 py-2.5 text-xs text-lime-100">
                      No significant vegetation anomalies were detected in this acquisition. Canopy distribution is
                      uniform and vigour is stable.
                    </li>
                  ) : null}
                </ul>
              </SectionCard>

              <SectionCard
                title="How to read the colour scale"
                description="Colour semantics are fixed across the map, the legend and the charts."
              >
                <ul className="space-y-2.5">
                  {NDVI_BANDS.map((entry) => (
                    <li key={entry.id} className="flex gap-3">
                      <span
                        className="mt-0.5 size-4 shrink-0 rounded"
                        style={{ background: entry.color }}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium">
                          {entry.label}
                          <span className="ml-2 font-mono text-2xs text-muted-foreground">
                            {entry.id === 'nodata'
                              ? 'masked'
                              : entry.id === 'stressed'
                                ? '< 0.20'
                                : entry.id === 'healthy'
                                  ? '≥ 0.65'
                                  : `${entry.range[0]}–${entry.range[1]}`}
                          </span>
                        </p>
                        <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">{entry.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Separator className="my-3.5" />
                <p className="text-2xs leading-relaxed text-muted-foreground">
                  NDVI is calculated as (NIR − Red) / (NIR + Red) from Sentinel-2 L2A surface reflectance. Grey cells are
                  pixels outside the boundary or masked by cloud and shadow.
                </p>
              </SectionCard>
            </div>

            {gridImage ? (
              <SectionCard
                title="Sampled index grid"
                description={`${gridImage.cols} × ${gridImage.rows} cells read from the scene, shown as a compact preview of the raster used for the statistics above.`}
              >
                <NdviGridPreview grid={gridImage} />
              </SectionCard>
            ) : null}
          </>
        ) : null}

        {!completed && !running && !vegetation ? (
          <InlineNotice tone="info">
            Vegetation intelligence is not loaded for this field yet.{' '}
            <button type="button" className="font-semibold underline" onClick={run}>
              Run the analysis
            </button>
            .
          </InlineNotice>
        ) : null}
      </div>
    </PageScaffold>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-2xs uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 truncate text-right', mono ? 'font-mono text-2xs tabular-nums' : 'text-xs font-medium')}>
        {value}
      </dd>
    </div>
  );
}

function AnomalyRow({
  tone,
  label,
  detail,
}: {
  tone: 'danger' | 'warning' | 'positive';
  label: string;
  detail: string;
}): JSX.Element {
  const tones = {
    danger: 'border-red-500/30 bg-red-500/[0.06]',
    warning: 'border-amber-500/30 bg-amber-500/[0.06]',
    positive: 'border-lime/30 bg-lime/[0.06]',
  } as const;
  const icons = {
    danger: ArrowDownRight,
    warning: ArrowDownRight,
    positive: ArrowUpRight,
  } as const;
  const Icon = icons[tone];
  return (
    <li className={cn('rounded-lg border px-3.5 py-2.5', tones[tone])}>
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 shrink-0" />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">{detail}</p>
    </li>
  );
}

/** Canvas preview of the sampled NDVI raster, drawn with the shared colour ramp. */
function NdviGridPreview({ grid }: { grid: { cols: number; rows: number; values: Array<number | null> } }): JSX.Element {
  const [failed, setFailed] = useState(false);

  const dataUrl = useMemo(() => {
    const cell = 8;
    const canvas = document.createElement('canvas');
    canvas.width = grid.cols * cell;
    canvas.height = grid.rows * cell;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.fillStyle = '#8C9793';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const anchors: Array<[number, [number, number, number]]> = [
      [-0.2, [136, 66, 52]],
      [0.1, [200, 72, 60]],
      [0.2, [227, 154, 52]],
      [0.35, [201, 214, 63]],
      [0.5, [79, 168, 74]],
      [0.65, [31, 122, 77]],
      [0.9, [16, 92, 62]],
    ];
    const ramp = (value: number): string => {
      const v = Math.max(-0.2, Math.min(0.9, value));
      for (let i = 0; i < anchors.length - 1; i += 1) {
        const [v0, c0] = anchors[i];
        const [v1, c1] = anchors[i + 1];
        if (v >= v0 && v <= v1) {
          const t = (v - v0) / (v1 - v0 || 1);
          return `rgb(${Math.round(c0[0] + (c1[0] - c0[0]) * t)},${Math.round(c0[1] + (c1[1] - c0[1]) * t)},${Math.round(c0[2] + (c1[2] - c0[2]) * t)})`;
        }
      }
      return 'rgb(16,92,62)';
    };

    for (let row = 0; row < grid.rows; row += 1) {
      for (let col = 0; col < grid.cols; col += 1) {
        const value = grid.values[row * grid.cols + col];
        if (value === null || value === undefined) continue;
        context.fillStyle = ramp(value);
        context.fillRect(col * cell, row * cell, cell, cell);
      }
    }
    return canvas.toDataURL('image/png');
  }, [grid]);

  if (!dataUrl || failed) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/70 px-4 py-6 text-xs text-muted-foreground">
        <ImageOff className="size-4" />
        The raster preview could not be rendered in this browser.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-forest-950 p-3">
      <img
        src={dataUrl}
        alt={`Sampled NDVI raster, ${grid.cols} by ${grid.rows} cells`}
        className="mx-auto block w-full max-w-xl rounded"
        style={{ imageRendering: 'pixelated' }}
        onError={() => setFailed(true)}
      />
      <p className="mt-2.5 flex items-center justify-center gap-2 text-2xs text-muted-foreground">
        <Satellite className="size-3" />
        {grid.cols} × {grid.rows} sampled cells · grey marks pixels outside the boundary or masked by cloud
      </p>
    </div>
  );
}

export { DataOriginBadge };
