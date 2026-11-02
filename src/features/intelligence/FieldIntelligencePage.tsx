import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Compass, ExternalLink, Layers, MapPin, Ruler, Satellite, Sprout, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { NoFieldSelected } from '@/components/common/FieldContextBar';
import { EmptyState, SourceNote, UnavailableState, InlineNotice } from '@/components/common/StateBlocks';
import {
  AnalysisErrorBanner,
  FieldHeaderCard,
  MetricTile,
  PageScaffold,
  SectionCard,
  SkeletonPanel,
} from '@/components/layout/PageScaffold';
import { EarthMap } from '@/components/map/EarthMap';
import { formatAcres, formatArea, formatCoord, formatDate, formatNumber, toDMS } from '@/lib/format';
import { useFieldIntelligence } from '@/hooks/useFieldIntelligence';
import { useFieldsStore } from '@/store/fieldsStore';
import { DATA_SOURCES, sourceWithRetrieval } from '@/services/sources';
import { ndviBandFor } from '@/services/satellite/colorRamp';
import type { DataSourceRef } from '@/types';

export default function FieldIntelligencePage(): JSX.Element {
  const { field, intelligence, stages, running, completed, error, analysedAt, run } = useFieldIntelligence();
  const selectField = useFieldsStore((s) => s.selectField);
  const deleteField = useFieldsStore((s) => s.deleteField);

  const { vegetation, soil, climate, evaluation, planning } = intelligence;

  const ndviBand = vegetation ? ndviBandFor(vegetation.stats.mean) : null;
  const fieldCoords = useMemo(() => field?.boundary.coords ?? null, [field]);
  const markers = useMemo(() => {
    if (!field) return [];
    return [{ coord: field.boundary.centroid, color: '#A8E600', radius: 6 }];
  }, [field]);

  if (!field) {
    return (
      <PageScaffold
        title="Field Intelligence"
        description="Boundary, satellite context and the signals that drive every downstream recommendation."
      >
        <NoFieldSelected />
      </PageScaffold>
    );
  }

  return (
    <PageScaffold
      title="Field Intelligence"
      description="Everything AgriSense knows about this field, with each value traced to its source."
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link to="/reports">Export report</Link>
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
        <FieldHeaderCard
          field={field}
          analysedAt={analysedAt}
          onRefresh={run}
          refreshing={running}
          stages={stages}
        />

        {error ? <AnalysisErrorBanner message={error} onRetry={run} /> : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          {/* ------------------------------------------------------- map + boundary */}
          <SectionCard
            title="Boundary and satellite preview"
            description="The drawn polygon over Sentinel-2 imagery, with a centroid marker."
            bodyClassName="p-0"
            actions={<Badge variant="outline">{field.boundary.vertexCount} vertices</Badge>}
          >
            <div className="h-[320px] overflow-hidden border-y border-border/60 sm:h-[380px]">
              <EarthMap
                fieldCoords={fieldCoords}
                markers={markers}
                compact
                className="size-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-px bg-border/60 sm:grid-cols-4">
              <Tile label="Area" value={formatArea(field.boundary.areaM2)} sub={formatAcres(field.boundary.areaM2)} />
              <Tile
                label="Perimeter"
                value={`${(field.boundary.perimeterM / 1000).toFixed(2)} km`}
                sub="great-circle"
              />
              <Tile label="Centroid" value={formatCoord(field.boundary.centroid, 3)} sub={toDMS(field.boundary.centroid.lat, true)} />
              <Tile label="Vertices" value={String(field.boundary.vertexCount)} sub="ring closed" />
            </div>
          </SectionCard>

          {/* ------------------------------------------------------------ overview */}
          <div className="space-y-4">
            <SectionCard title="Field overview" description="Identity and location context for this boundary.">
              <dl className="space-y-3 text-xs">
                <Row label="Field name" value={field.name} />
                <Row label="Selected location" value={field.locationLabel} />
                <Row label="Coordinates" value={formatCoord(field.boundary.centroid, 5)} mono />
                <Row label="Latitude (DMS)" value={toDMS(field.boundary.centroid.lat, true)} mono />
                <Row label="Longitude (DMS)" value={toDMS(field.boundary.centroid.lng, false)} mono />
                <Row label="Created" value={formatDate(field.createdAt, { hour: '2-digit', minute: '2-digit' })} />
                {soil?.texture ? <Row label="Soil texture" value={soil.texture.label} /> : null}
              </dl>
              <Separator className="my-3.5" />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={run} disabled={running}>
                  <Compass className="size-3.5" />
                  {running ? 'Analysing…' : 'Re-run analysis'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-red-300"
                  onClick={() => {
                    deleteField(field.id);
                    selectField(null);
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Delete field
                </Button>
              </div>
            </SectionCard>

            <SectionCard title="Signal summary" description="Headline values drawn from the analysis pipeline.">
              {running && !completed ? (
                <SkeletonPanel rows={4} />
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <MetricTile
                    label="Mean NDVI"
                    value={vegetation ? vegetation.stats.mean.toFixed(3) : '—'}
                    sub={ndviBand ? ndviBand.label : vegetation ? undefined : 'Vegetation unavailable'}
                    tone={vegetation ? 'positive' : 'muted'}
                  />
                  <MetricTile
                    label="Soil pH"
                    value={
                      soil?.properties.find((p) => p.id === 'phh2o')?.value !== null &&
                      soil?.properties.find((p) => p.id === 'phh2o')?.value !== undefined
                        ? (soil.properties.find((p) => p.id === 'phh2o')?.value as number).toFixed(1)
                        : '—'
                    }
                    sub={soil ? '0–5 cm depth' : 'Soil unavailable'}
                    tone={soil ? 'default' : 'muted'}
                  />
                  <MetricTile
                    label="Annual rainfall"
                    value={climate?.annualRainfallMm !== null && climate?.annualRainfallMm !== undefined ? Math.round(climate.annualRainfallMm).toString() : '—'}
                    unit="mm"
                    sub={climate?.rainfallPeriodLabel ?? 'Climate unavailable'}
                    tone={climate ? 'default' : 'muted'}
                  />
                  <MetricTile
                    label="Temp range"
                    value={
                      climate?.tempRange.minC !== null && climate?.tempRange.minC !== undefined && climate.tempRange.maxC !== null
                        ? `${climate.tempRange.minC.toFixed(0)}…${climate.tempRange.maxC.toFixed(0)}`
                        : '—'
                    }
                    unit="°C"
                    sub="observed min / max"
                    tone={climate ? 'default' : 'muted'}
                  />
                  <MetricTile
                    label="Crop candidates"
                    value={evaluation ? String(evaluation.recommended.length + evaluation.conditional.length) : '—'}
                    sub={evaluation ? `of ${evaluation.datasetSize} profiles scored` : 'Suitability unavailable'}
                    tone={evaluation ? 'positive' : 'muted'}
                  />
                  <MetricTile
                    label="Crop zones"
                    value={planning ? String(planning.zones.length) : '—'}
                    sub={planning ? `${planning.rotation.length} rotation slots` : 'Planning unavailable'}
                    tone={planning ? 'positive' : 'muted'}
                  />
                </div>
              )}
            </SectionCard>
          </div>
        </div>

        {/* ------------------------------------------------------- analysis details */}
        <SectionCard
          title="Analysis operations"
          description="Each operation reports the real outcome of the corresponding data request."
        >
          <ul className="space-y-2">
            {stages.map((stage) => (
              <li key={stage.id} className="rounded-lg border border-border/60 bg-muted/15 px-3.5 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium">{stage.label}</span>
                  <Badge
                    variant={
                      stage.state === 'done'
                        ? 'success'
                        : stage.state === 'active'
                          ? 'lime'
                          : stage.state === 'unavailable'
                            ? 'warning'
                            : stage.state === 'error'
                              ? 'danger'
                              : 'muted'
                    }
                  >
                    {stage.state}
                  </Badge>
                </div>
                <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">{stage.detail ?? stage.description}</p>
                {stage.source ? (
                  <p className="mt-1 text-2xs text-muted-foreground/70">Source: {stage.source}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* ------------------------------------------------------------- provenance */}
        <SectionCard title="Data sources" description="Every provider used for this field, with licence and retrieval time.">
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              sourceWithRetrieval('sentinelCatalog'),
              sourceWithRetrieval('sentinelCogs'),
              sourceWithRetrieval('soilGrids'),
              sourceWithRetrieval('openMeteoArchive'),
              sourceWithRetrieval('openMeteoForecast'),
              sourceWithRetrieval('openMeteoAir'),
              DATA_SOURCES.rulesEngine,
              DATA_SOURCES.rulesDataset,
            ] as DataSourceRef[]).map((source) => (
              <div key={source.id} className="rounded-lg border border-border/60 bg-muted/15 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium">{source.label}</span>
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-muted-foreground transition-colors hover:text-lime"
                      aria-label={`Open ${source.label}`}
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
                <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">{source.note}</p>
                <SourceNote source={source} className="mt-1.5" />
              </div>
            ))}
          </div>
        </SectionCard>

        {!completed && !running ? (
          <InlineNotice tone="info">
            This field has not been analysed in this session yet.{' '}
            <button type="button" className="font-semibold underline" onClick={run}>
              Run the analysis
            </button>{' '}
            to populate vegetation, soil and climate intelligence.
          </InlineNotice>
        ) : null}
      </div>
    </PageScaffold>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }): JSX.Element {
  return (
    <div className="bg-card px-3.5 py-3">
      <div className="label-caps">{label}</div>
      <div className="mt-1 font-mono text-xs font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-2xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-2xs uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className={mono ? 'text-right font-mono text-xs tabular-nums' : 'text-right text-xs font-medium'}>{value}</dd>
    </div>
  );
}

export { EmptyState, UnavailableState, Satellite, Layers, MapPin, Ruler, formatNumber };
