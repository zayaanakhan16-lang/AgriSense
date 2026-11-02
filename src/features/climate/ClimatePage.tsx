import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Droplets, Sprout, Thermometer, TrendingDown, TrendingUp, Wind } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { BarSeriesChart, TimeSeriesChart } from '@/components/charts/Charts';
import { sourceWithRetrieval } from '@/services/sources';
import { formatDate, formatDateTime, formatNumber, formatSigned } from '@/lib/format';
import { useFieldIntelligence } from '@/hooks/useFieldIntelligence';
import { cn } from '@/lib/utils';

export default function ClimatePage(): JSX.Element {
  const { field, intelligence, stages, running, completed, error, analysedAt, run } = useFieldIntelligence();
  const { climate, climateError } = intelligence;
  const [window, setWindow] = useState<'forecast' | 'history'>('forecast');

  const forecastDays = useMemo(() => climate?.days.filter((d) => d.soilMoistureSurface !== null) ?? [], [climate]);
  const historyDays = useMemo(() => {
    if (!climate) return [];
    const cutoff = Date.now() - 365 * 86400000;
    return climate.days.filter((d) => new Date(d.date).getTime() >= cutoff);
  }, [climate]);

  const series = useMemo(() => {
    const source = window === 'forecast' ? forecastDays : historyDays;
    const step = window === 'history' ? Math.max(1, Math.ceil(source.length / 120)) : 1;
    return source
      .filter((_, index) => index % step === 0)
      .map((day) => ({
        date: day.date,
        precipitation: day.precipitationMm,
        tempMax: day.tempMaxC,
        tempMin: day.tempMinC,
        tempMean: day.tempMeanC,
        et0: day.et0Mm,
        surface: day.soilMoistureSurface,
        deep: day.soilMoistureDeep,
      }));
  }, [window, forecastDays, historyDays]);

  const monthlyRain = useMemo(() => {
    if (!climate) return [];
    const buckets = new Map<string, number>();
    climate.days.forEach((day) => {
      const key = day.date.slice(0, 7);
      buckets.set(key, (buckets.get(key) ?? 0) + (day.precipitationMm ?? 0));
    });
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([month, total]) => ({
        month: new Date(`${month}-01`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        rainfall: Number(total.toFixed(1)),
      }));
  }, [climate]);

  if (!field) {
    return (
      <PageScaffold
        title="Climate Intelligence"
        description="Rainfall, temperature, reference evapotranspiration, soil moisture and air quality."
      >
        <NoFieldSelected />
      </PageScaffold>
    );
  }

  const aq = climate?.airQuality ?? null;
  const latestMoisture = forecastDays[0] ?? null;

  return (
    <PageScaffold
      title="Climate Intelligence"
      description="Assembled from the Open-Meteo forecast API and the ERA5 reanalysis archive for the field centroid."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={run} disabled={running}>
            Refresh climate data
          </Button>
          <Button asChild variant="lime" size="sm">
            <Link to="/decision">
              <Sprout className="size-3.5" />
              Decision center
            </Link>
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-4 sm:p-6">
        <FieldHeaderCard field={field} analysedAt={analysedAt} onRefresh={run} refreshing={running} stages={stages} />

        {error ? <AnalysisErrorBanner message={error} onRetry={run} /> : null}

        {running && !climate ? (
          <SectionCard title="Assembling climate history">
            <SkeletonPanel rows={6} />
          </SectionCard>
        ) : null}

        {climateError && !climate ? (
          <UnavailableState
            title="Climate data unavailable"
            message={climateError}
            source={sourceWithRetrieval('openMeteoArchive').label}
          />
        ) : null}

        {climate ? (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <MetricTile
                label="Annual rainfall"
                value={climate.annualRainfallMm !== null ? Math.round(climate.annualRainfallMm).toString() : '—'}
                unit="mm"
                sub={climate.rainfallPeriodLabel}
              />
              <MetricTile
                label="Reference ET₀"
                value={climate.totalEt0Mm !== null ? Math.round(climate.totalEt0Mm).toString() : '—'}
                unit="mm"
                sub="cumulative over the record"
              />
              <MetricTile
                label="Temperature range"
                value={
                  climate.tempRange.minC !== null && climate.tempRange.maxC !== null
                    ? `${climate.tempRange.minC.toFixed(1)} … ${climate.tempRange.maxC.toFixed(1)}`
                    : '—'
                }
                unit="°C"
                sub="observed over the record"
              />
              <MetricTile
                label="Surface soil moisture"
                value={latestMoisture?.soilMoistureSurface !== null && latestMoisture?.soilMoistureSurface !== undefined ? latestMoisture.soilMoistureSurface.toFixed(3) : '—'}
                unit="m³/m³"
                sub={latestMoisture ? `modelled for ${formatDate(latestMoisture.date)}` : 'forecast unavailable'}
                tone={latestMoisture ? 'default' : 'muted'}
              />
            </div>

            <SectionCard
              title="Climate record"
              description="Toggle between the 16-day forecast and the trailing 12-month reanalysis."
              actions={
                <Tabs value={window} onValueChange={(value) => setWindow(value as typeof window)}>
                  <TabsList>
                    <TabsTrigger value="forecast">16-day forecast</TabsTrigger>
                    <TabsTrigger value="history">12-month history</TabsTrigger>
                  </TabsList>
                </Tabs>
              }
            >
              <Tabs value={window} onValueChange={(value) => setWindow(value as typeof window)}>
                <TabsContent value="forecast" className="mt-0">
                  <p className="mb-3 text-2xs text-muted-foreground">
                    Forecast window · {forecastDays.length} days with modelled soil moisture from Open-Meteo.
                  </p>
                  <TimeSeriesChart
                    data={series}
                    series={[
                      { key: 'tempMax', name: 'Max temp', color: '#E39A34' },
                      { key: 'tempMin', name: 'Min temp', color: '#7FB6E0' },
                    ]}
                    height={220}
                    formatValue={(value) => `${value.toFixed(1)} °C`}
                  />
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold">
                        <Droplets className="size-3.5 text-lime" /> Precipitation (mm/day)
                      </h4>
                      <BarSeriesChart
                        data={series}
                        xKey="date"
                        series={[{ key: 'precipitation', name: 'Rainfall', color: '#4FA84A' }]}
                        height={170}
                        formatValue={(value) => `${value.toFixed(1)} mm`}
                      />
                    </div>
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold">
                        <Wind className="size-3.5 text-lime" /> Reference ET₀ (mm/day)
                      </h4>
                      <TimeSeriesChart
                        data={series}
                        series={[{ key: 'et0', name: 'ET₀', color: '#A8E600' }]}
                        area
                        height={170}
                        formatValue={(value) => `${value.toFixed(2)} mm`}
                      />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="history" className="mt-0">
                  <p className="mb-3 text-2xs text-muted-foreground">
                    ERA5 reanalysis · {historyDays.length} days, downsampled for readability.
                  </p>
                  <TimeSeriesChart
                    data={series}
                    series={[
                      { key: 'tempMax', name: 'Max temp', color: '#E39A34' },
                      { key: 'tempMin', name: 'Min temp', color: '#7FB6E0' },
                    ]}
                    height={220}
                    formatValue={(value) => `${value.toFixed(1)} °C`}
                  />
                  <div className="mt-4">
                    <h4 className="mb-2 text-xs font-semibold">Monthly rainfall totals (mm)</h4>
                    <BarSeriesChart
                      data={monthlyRain}
                      xKey="month"
                      series={[{ key: 'rainfall', name: 'Rainfall', color: '#4FA84A' }]}
                      height={180}
                      formatValue={(value) => `${value.toFixed(1)} mm`}
                    />
                  </div>
                </TabsContent>
              </Tabs>
              <Separator className="my-3.5" />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <SourceNote source={sourceWithRetrieval('openMeteoForecast')} />
                <SourceNote source={sourceWithRetrieval('openMeteoArchive')} />
              </div>
            </SectionCard>

            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard
                title="Soil moisture profile"
                description="Modelled volumetric water content at the surface and in the deeper profile."
              >
                {climate.soilMoistureSeries.length ? (
                  <TimeSeriesChart
                    data={climate.soilMoistureSeries.map((entry) => ({
                      date: entry.date,
                      surface: entry.surface,
                      deep: entry.deep,
                    }))}
                    series={[
                      { key: 'surface', name: '0–7 cm', color: '#A8E600' },
                      { key: 'deep', name: '28–100 cm', color: '#3E9E7C' },
                    ]}
                    area
                    height={220}
                    formatValue={(value) => `${value.toFixed(3)} m³/m³`}
                  />
                ) : (
                  <InlineNotice tone="warning">
                    Modelled soil moisture was not returned for this location. The forecast endpoint may be temporarily
                    unavailable — retry the analysis in a moment.
                  </InlineNotice>
                )}
                <Separator className="my-3.5" />
                <p className="text-2xs leading-relaxed text-muted-foreground">
                  Deeper-layer moisture is what allows a field to ride out short dry spells. When the surface dries but
                  the deeper profile holds, targeted irrigation usually outperforms a full-field pass.
                </p>
              </SectionCard>

              <div className="space-y-4">
                <SectionCard title="Climate anomalies" description="Departures from the trailing 12-month baseline.">
                  {climate.anomalies.length ? (
                    <ul className="space-y-2.5">
                      {climate.anomalies.map((anomaly) => {
                        const positive = anomaly.value >= anomaly.baseline || (anomaly.id === 'temperature' && anomaly.value >= 0);
                        return (
                          <li
                            key={anomaly.id}
                            className={cn(
                              'rounded-lg border px-3.5 py-3',
                              anomaly.severity === 'high'
                                ? 'border-amber-500/30 bg-amber-500/[0.06]'
                                : anomaly.severity === 'moderate'
                                  ? 'border-sky-500/25 bg-sky-500/[0.05]'
                                  : 'border-border/60 bg-muted/15',
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                {positive ? (
                                  <TrendingUp className="size-3.5 text-amber-400" />
                                ) : (
                                  <TrendingDown className="size-3.5 text-sky-400" />
                                )}
                                <span className="text-xs font-medium">{anomaly.label}</span>
                              </div>
                              <Badge
                                variant={anomaly.severity === 'high' ? 'warning' : anomaly.severity === 'moderate' ? 'info' : 'muted'}
                              >
                                {anomaly.severity}
                              </Badge>
                            </div>
                            <div className="mt-1.5 flex items-baseline gap-2">
                              <span className="font-mono text-sm font-semibold tabular-nums">
                                {anomaly.id === 'temperature' ? formatSigned(anomaly.value, 2) : formatNumber(anomaly.value, 1)}
                                <span className="ml-1 text-2xs font-normal text-muted-foreground">{anomaly.unit}</span>
                              </span>
                              <span className="text-2xs text-muted-foreground">
                                baseline {formatNumber(anomaly.baseline, 1)} {anomaly.unit}
                              </span>
                            </div>
                            <p className="mt-1.5 text-2xs leading-relaxed text-muted-foreground">{anomaly.description}</p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <InlineNotice tone="info">
                      Not enough history was returned to compute a meaningful anomaly against the baseline.
                    </InlineNotice>
                  )}
                </SectionCard>

                <SectionCard title="Air quality" description="Modelled near-surface particulate concentrations.">
                  {aq ? (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <MetricTile
                          label="PM2.5"
                          value={aq.pm25 !== null ? aq.pm25.toFixed(1) : '—'}
                          unit="µg/m³"
                          sub={aq.aqiLabel}
                          tone={aq.pm25 !== null && aq.pm25 > 35 ? 'warning' : 'default'}
                        />
                        <MetricTile
                          label="PM10"
                          value={aq.pm10 !== null ? aq.pm10.toFixed(1) : '—'}
                          unit="µg/m³"
                          sub="coarse particulate"
                        />
                      </div>
                      <Separator className="my-3.5" />
                      <p className="text-2xs leading-relaxed text-muted-foreground">
                        Retrieved {formatDateTime(aq.retrievedAt)}. Particulate load affects stomatal conductance and
                        therefore photosynthesis, though at field scale its effect is usually secondary to water.
                      </p>
                      <SourceNote source={sourceWithRetrieval('openMeteoAir')} className="mt-2.5" />
                    </>
                  ) : (
                    <InlineNotice tone="warning">
                      Air quality data was not returned for this location.
                    </InlineNotice>
                  )}
                </SectionCard>
              </div>
            </div>

            <SectionCard title="What this means for the field">
              <ul className="space-y-2.5">
                <Insight
                  icon={Thermometer}
                  title="Evaporative demand"
                  text={
                    climate.totalEt0Mm !== null && climate.annualRainfallMm !== null
                      ? climate.totalEt0Mm > climate.annualRainfallMm
                        ? `Reference evapotranspiration exceeds rainfall in this record, so the field runs a structural water deficit. Irrigation timing matters more than irrigation volume.`
                        : `Rainfall keeps pace with reference evapotranspiration in this record, so the field is not structurally water-limited.`
                      : 'Evapotranspiration or rainfall was not returned, so the water balance could not be assessed.'
                  }
                />
                <Insight
                  icon={Droplets}
                  title="Stored moisture"
                  text={
                    latestMoisture?.soilMoistureDeep !== null && latestMoisture?.soilMoistureDeep !== undefined
                      ? `The deeper profile currently holds ${latestMoisture.soilMoistureDeep.toFixed(3)} m³/m³. Compare that against the surface value before deciding to irrigate.`
                      : 'Modelled deeper-profile moisture was not available for this field.'
                  }
                />
                <Insight
                  icon={Wind}
                  title="Anomaly watch"
                  text={
                    climate.anomalies.length
                      ? climate.anomalies
                          .map((anomaly) => `${anomaly.label}: ${anomaly.description}`)
                          .join(' ')
                      : 'No anomalies could be computed against the baseline.'
                  }
                />
              </ul>
            </SectionCard>
          </>
        ) : null}

        {!completed && !running && !climate ? (
          <InlineNotice tone="info">
            Climate intelligence is not loaded for this field yet.{' '}
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

function Insight({ icon: Icon, title, text }: { icon: typeof Droplets; title: string; text: string }): JSX.Element {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-lime/10 text-lime">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium">{title}</p>
        <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </li>
  );
}
