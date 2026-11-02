import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Mountain, Sprout } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { NoFieldSelected } from '@/components/common/FieldContextBar';
import { InlineNotice, SourceNote, UnavailableState } from '@/components/common/StateBlocks';
import {
  AnalysisErrorBanner,
  FieldHeaderCard,
  MetricTile,
  PageScaffold,
  SectionCard,
  SkeletonPanel,
} from '@/components/layout/PageScaffold';
import { BarSeriesChart } from '@/components/charts/Charts';
import { sourceWithRetrieval } from '@/services/sources';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useFieldIntelligence } from '@/hooks/useFieldIntelligence';
import { cn } from '@/lib/utils';
import type { SoilProperty } from '@/types';

const HIGHLIGHT_IDS = ['phh2o', 'soc', 'nitrogen', 'cec', 'wv0033', 'clay'];

export default function SoilPage(): JSX.Element {
  const { field, intelligence, stages, running, completed, error, analysedAt, run } = useFieldIntelligence();
  const { soil, soilError } = intelligence;

  const textureData = useMemo(() => {
    if (!soil?.texture) return [];
    return soil.texture.components
      .filter((component) => component.fraction !== null)
      .map((component) => ({
        component: component.label,
        share: Number(((component.fraction ?? 0) * 100).toFixed(1)),
      }));
  }, [soil]);

  const ordered = useMemo(() => {
    if (!soil) return [];
    const highlights = HIGHLIGHT_IDS.map((id) => soil.properties.find((p) => p.id === id)).filter(
      (p): p is SoilProperty => Boolean(p),
    );
    const rest = soil.properties.filter((p) => !HIGHLIGHT_IDS.includes(p.id));
    return [...highlights, ...rest];
  }, [soil]);

  if (!field) {
    return (
      <PageScaffold
        title="Soil Intelligence"
        description="ISRIC SoilGrids properties, texture composition and water retention at the field centroid."
      >
        <NoFieldSelected />
      </PageScaffold>
    );
  }

  return (
    <PageScaffold
      title="Soil Intelligence"
      description="Gridded soil properties retrieved from ISRIC SoilGrids v2.0, converted from mapped to target units."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={run} disabled={running}>
            Refresh soil data
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

        {running && !soil ? (
          <SectionCard title="Retrieving soil profile">
            <SkeletonPanel rows={6} />
          </SectionCard>
        ) : null}

        {soilError && !soil ? (
          <UnavailableState
            title="Soil profile unavailable"
            message={soilError}
            source={sourceWithRetrieval('soilGrids').label}
          />
        ) : null}

        {soil ? (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {HIGHLIGHT_IDS.slice(0, 4).map((id) => {
                const property = soil.properties.find((p) => p.id === id);
                if (!property) return null;
                return (
                  <MetricTile
                    key={id}
                    label={property.label}
                    value={property.value === null ? '—' : formatNumber(property.value, property.value < 10 ? 2 : 1)}
                    unit={property.unit}
                    sub={property.depth}
                    tone={property.value === null ? 'muted' : 'default'}
                  />
                );
              })}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <SectionCard
                title="Soil properties"
                description="Values are the SoilGrids mean for the 0–5 cm interval unless noted."
                actions={<Badge variant="outline">{soil.properties.length} properties</Badge>}
              >
                <ul className="space-y-2.5">
                  {ordered.map((property) => (
                    <li key={property.id} className="rounded-lg border border-border/60 bg-muted/15 px-3.5 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{property.label}</span>
                          <Badge variant="muted">{property.depth}</Badge>
                        </div>
                        <span className="font-mono text-sm font-semibold tabular-nums">
                          {property.value === null ? 'No data' : formatNumber(property.value, property.value < 10 ? 2 : 1)}
                          {property.value !== null ? (
                            <span className="ml-1 text-2xs font-normal text-muted-foreground">{property.unit}</span>
                          ) : null}
                        </span>
                      </div>
                      {property.value !== null && property.range ? (
                        <PropertyBand property={property} />
                      ) : null}
                      <p className="mt-1.5 text-2xs leading-relaxed text-muted-foreground">{property.description}</p>
                      {property.mappedValue !== null && property.mappedValue !== undefined && property.mappedUnit ? (
                        <p className="mt-1 font-mono text-[0.625rem] text-muted-foreground/70">
                          SoilGrids stored {property.mappedValue} {property.mappedUnit}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <Separator className="my-3.5" />
                <SourceNote source={sourceWithRetrieval('soilGrids')} />
              </SectionCard>

              <div className="space-y-4">
                {soil.texture ? (
                  <SectionCard
                    title="Soil texture"
                    description={`Derived from the SoilGrids clay, silt and sand fractions — classified as ${soil.texture.label}.`}
                  >
                    <BarSeriesChart
                      data={textureData}
                      xKey="component"
                      series={[{ key: 'share', name: 'Fraction', color: '#A8E600' }]}
                      height={170}
                      formatValue={(value) => `${value.toFixed(1)}%`}
                    />
                    <ul className="mt-3 space-y-1.5">
                      {soil.texture.components.map((component) => (
                        <li key={component.label} className="flex items-center justify-between text-2xs">
                          <span className="text-muted-foreground">{component.label}</span>
                          <span className="font-mono tabular-nums">
                            {component.fraction === null ? '—' : `${(component.fraction * 100).toFixed(1)}%`}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-2xs leading-relaxed text-muted-foreground">
                      Texture drives water retention, drainage and how the rules engine matches crops to this field.
                    </p>
                  </SectionCard>
                ) : null}

                <SectionCard title="Water retention profile" description="Retention at three matric potentials.">
                  <ul className="space-y-2.5">
                    {['wv0010', 'wv0033', 'wv1500'].map((id) => {
                      const property = soil.properties.find((p) => p.id === id);
                      if (!property) return null;
                      const tone =
                        id === 'wv1500' ? 'text-amber-300' : id === 'wv0033' ? 'text-lime-300' : 'text-foreground';
                      return (
                        <li key={id} className="flex items-center justify-between gap-3 border-b border-border/50 pb-2.5 last:border-b-0 last:pb-0">
                          <div>
                            <p className="text-xs font-medium">{property.label}</p>
                            <p className="mt-0.5 text-2xs text-muted-foreground">{property.description}</p>
                          </div>
                          <span className={cn('shrink-0 font-mono text-sm font-semibold tabular-nums', tone)}>
                            {property.value === null ? '—' : property.value.toFixed(1)}
                            <span className="ml-1 text-2xs font-normal text-muted-foreground">cm³/100</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <Separator className="my-3.5" />
                  <p className="text-2xs leading-relaxed text-muted-foreground">
                    The gap between 33 kPa and 1500 kPa is plant-available water. A wider gap means the soil buffers the
                    crop through dry spells more effectively.
                  </p>
                </SectionCard>

                <SectionCard title="Retrieval metadata">
                  <dl className="space-y-2.5 text-xs">
                    <Row label="Provider" value="ISRIC — World Soil Information" />
                    <Row label="Dataset" value="SoilGrids v2.0" />
                    <Row label="Spatial resolution" value="250 m" />
                    <Row label="Sampling point" value={`${field.boundary.centroid.lat.toFixed(4)}, ${field.boundary.centroid.lng.toFixed(4)}`} mono />
                    <Row label="Retrieved" value={formatDateTime(soil.retrievedAt)} />
                    <Row label="Licence" value="CC BY 4.0" />
                  </dl>
                </SectionCard>
              </div>
            </div>
          </>
        ) : null}

        {!completed && !running && !soil ? (
          <InlineNotice tone="info">
            Soil intelligence is not loaded for this field yet.{' '}
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

/** Compact position indicator showing where the value sits inside a plausible range. */
function PropertyBand({ property }: { property: SoilProperty }): JSX.Element | null {
  if (property.value === null || !property.range) return null;
  const [min, max] = property.range;
  const ratio = Math.max(0, Math.min(1, (property.value - min) / (max - min || 1)));
  const tone =
    property.polarity === 'higher'
      ? 'bg-lime'
      : property.polarity === 'lower'
        ? 'bg-amber-400'
        : 'bg-sky-400';
  return (
    <div className="mt-2">
      <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn('absolute inset-y-0 left-0 rounded-full', tone)} style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[0.625rem] text-muted-foreground/70">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-2xs uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className={mono ? 'text-right font-mono text-2xs tabular-nums' : 'text-right text-xs font-medium'}>{value}</dd>
    </div>
  );
}

export { Mountain };
