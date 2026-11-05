import { useMemo, useState } from 'react';
import { CalendarDays, Droplets, Gauge, Sprout, Wind } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatAcres } from '@/lib/format';
import { EarthMap } from '@/components/map/EarthMap';
import { BarSeriesChart, TimeSeriesChart, AllocationDonut, FactorRadar } from '@/components/charts/Charts';
import { EarthWorkspace } from '@/features/earth/EarthWorkspace';
import { useFieldsStore } from '@/store/fieldsStore';
import {
  buildAgMetrics,
  buildAirWaterMetrics,
  buildAllocation,
  buildDailySeries,
  buildLandUse,
  buildSuitability,
  buildWeatherSnapshot,
} from '@/services/regionAnalytics';

const ACCENT = '#E3B341';

function todayIso(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export default function RegionAnalyticsPage(): JSX.Element {
  const fields = useFieldsStore((s) => s.fields);
  const selectedFieldId = useFieldsStore((s) => s.selectedFieldId);
  const selectedField = fields.find((field) => field.id === selectedFieldId) ?? fields[0] ?? null;

  const [startDate, setStartDate] = useState(todayIso(-180));
  const [endDate, setEndDate] = useState(todayIso(0));
  const [activeSlice, setActiveSlice] = useState<string | null>(null);

  const analytics = useMemo(() => {
    if (!selectedField) return null;
    const centroid = selectedField.boundary.centroid;
    const area = selectedField.boundary.areaM2;
    const daily = buildDailySeries(centroid, area, new Date(startDate), new Date(endDate));
    // Downsample so long windows stay readable.
    const step = Math.max(1, Math.ceil(daily.length / 160));
    return {
      weather: buildWeatherSnapshot(centroid, area),
      daily: daily.filter((_, index) => index % step === 0),
      airWater: buildAirWaterMetrics(centroid, area),
      ag: buildAgMetrics(centroid, area),
      landUse: buildLandUse(centroid, area),
      suitability: buildSuitability(centroid, area),
      allocation: buildAllocation(centroid, area),
    };
  }, [selectedField, startDate, endDate]);

  if (!selectedField || !analytics) {
    return (
      <EarthWorkspace mode="analytics">
        <div className="flex size-full items-center justify-center bg-forest-950">
          <div className="chrome max-w-sm p-6 text-center">
            <Sprout className="mx-auto size-6 text-lime" aria-hidden />
            <h1 className="mt-3 type-section text-cream">No region selected</h1>
            <p className="mt-1 text-2xs leading-relaxed text-cream/60">
              Draw or select a region on the Earth Explorer to open its analytics.
            </p>
          </div>
        </div>
      </EarthWorkspace>
    );
  }

  return (
    <EarthWorkspace mode="analytics">
      <div className="relative size-full overflow-hidden bg-forest-950">
        {/* Blurred satellite backdrop keeps the map application shell visible. */}
        <div className="pointer-events-none absolute inset-0 opacity-40 blur-[2px]">
          <EarthMap
            fieldCoords={selectedField.boundary.coords}
            showCursorReadout={false}
            compact
            className="size-full"
          />
        </div>

        {/* -------------------------------------------------------- scroll content */}
        <div className="relative z-10 h-full overflow-y-auto px-3 pb-8 pt-20 sm:px-5">
          <div className="mx-auto w-full max-w-[1180px] space-y-4">
            {/* ------------------------------------------------------- header */}
            <div className="chrome p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="font-display text-base font-semibold text-cream">Region Analytics</h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant="lime">{selectedField.name}</Badge>
                    <Badge variant="muted">{selectedField.crop ?? 'Wheat'}</Badge>
                    <span className="font-mono text-2xs tabular-nums text-cream/70">
                      {formatAcres(selectedField.boundary.areaM2)}
                    </span>
                    {selectedField.isSample ? <Badge variant="warning">Demo</Badge> : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <DateField label="Start date" value={startDate} onChange={setStartDate} max={endDate} />
                  <DateField label="End date" value={endDate} onChange={setEndDate} min={startDate} />
                </div>
              </div>

              <Separator className="my-3 bg-white/[0.08]" />
              <p className="text-2xs leading-relaxed text-cream/50">
                Demonstration analytics. Values are derived from the region’s geometry with a deterministic model — they
                are not live field measurements.
              </p>
            </div>

            {/* --------------------------------------------------- weather strip */}
            <div className="chrome flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-full bg-lime/15 text-lime">
                  <Wind className="size-5" />
                </span>
                <div>
                  <p className="font-mono text-2xl font-semibold tabular-nums text-cream">
                    {analytics.weather.temperatureC.toFixed(0)}°C
                  </p>
                  <p className="text-2xs text-cream/60">{analytics.weather.condition}</p>
                </div>
              </div>
              <WeatherStat label="Feels like" value={`${analytics.weather.feelsLikeC.toFixed(0)}°C`} />
              <WeatherStat label="Humidity" value={`${analytics.weather.humidityPct.toFixed(0)}%`} />
              <WeatherStat label="Wind" value={`${analytics.weather.windKph.toFixed(0)} km/h`} />
              <WeatherStat
                label="Air quality"
                value={`AQI ${analytics.weather.aqi}`}
                sub={analytics.weather.aqiLabel}
              />
              <span className="ml-auto max-w-[260px] text-2xs leading-relaxed text-amber-300/80">
                {analytics.weather.accuracyNote}
              </span>
            </div>

            {/* ------------------------------------------------ precipitation chart */}
            <section className="chrome p-4">
              <ChartHeading title="Daily Precipitation, mm" icon={Droplets} />
              <BarSeriesChart
                data={analytics.daily.map((point) => ({ date: point.date, precipitation: point.precipitationMm }))}
                xKey="date"
                series={[{ key: 'precipitation', name: 'Precipitation', color: ACCENT }]}
                height={220}
                formatValue={(value) => `${value.toFixed(1)} mm`}
              />
            </section>

            {/* --------------------------------------------- temperature range chart */}
            <section className="chrome p-4">
              <ChartHeading title="Temperature Range, °C" icon={Gauge} />
              <TimeSeriesChart
                data={analytics.daily.map((point) => ({
                  date: point.date,
                  tempMax: point.tempMaxC,
                  tempMin: point.tempMinC,
                }))}
                series={[
                  { key: 'tempMax', name: 'Max', color: '#E39A34' },
                  { key: 'tempMin', name: 'Min', color: '#7FB6E0', dash: true },
                ]}
                height={220}
                formatValue={(value) => `${value.toFixed(1)} °C`}
              />
              <ChartLegend
                items={[
                  { label: 'Maximum', color: '#E39A34', solid: true },
                  { label: 'Minimum', color: '#7FB6E0', solid: false },
                ]}
              />
            </section>

            {/* --------------------------------------------- air & water quality cards */}
            <section className="chrome p-4">
              <ChartHeading title="Air & Water Quality" icon={Wind} />
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {analytics.airWater.map((metric) => (
                  <MetricCard
                    key={metric.id}
                    label={metric.label}
                    value={metric.value}
                    unit={metric.unit}
                    hint={metric.hint}
                  />
                ))}
              </div>
              <Separator className="my-3.5 bg-white/[0.08]" />
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {analytics.ag.map((metric) => (
                  <MetricCard
                    key={metric.id}
                    label={metric.label}
                    value={metric.value}
                    unit={metric.unit}
                    hint={metric.hint}
                  />
                ))}
              </div>
            </section>

            {/* ------------------------------------------- land use + suitability grid */}
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="chrome p-4">
                <ChartHeading title="Regional Land Use" icon={Sprout} />
                <AllocationDonut
                  data={analytics.landUse.map((slice) => ({ name: slice.name, value: slice.value, color: slice.color }))}
                  height={200}
                />
                <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {analytics.landUse.map((slice) => (
                    <li key={slice.name} className="flex items-center gap-2 text-2xs">
                      <span className="size-2.5 rounded-sm" style={{ background: slice.color }} aria-hidden />
                      <span className="flex-1 truncate text-cream/75">{slice.name}</span>
                      <span className="font-mono tabular-nums text-cream/55">{(slice.value * 100).toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="chrome p-4">
                <ChartHeading title="Land Suitability Score" icon={Gauge} />
                <FactorRadar data={analytics.suitability} height={230} />
              </section>
            </div>

            {/* ------------------------------------------- planning outcome metrics */}
            <div className="grid gap-4 sm:grid-cols-2">
              <OutcomeCard label="Water Saved" value="22%" note="Illustrative target from the allocation plan above — not a measured saving." />
              <OutcomeCard label="Revenue Boost" value="+14%" note="Illustrative target from the allocation plan above — not a verified result." />
            </div>

            {/* -------------------------------------------------- zone allocation */}
            <section className="chrome p-4">
              <ChartHeading title="Zone Allocation" icon={Sprout} />
              <div className="grid items-center gap-4 lg:grid-cols-2">
                <AllocationDonut
                  data={analytics.allocation.map((slice) => ({
                    name: slice.name,
                    value: slice.share,
                    color: slice.color,
                  }))}
                  height={240}
                  activeName={activeSlice}
                  onSelect={(name) => setActiveSlice(activeSlice === name ? null : name)}
                  centerLabel={{ value: String(analytics.allocation.length), caption: 'zones' }}
                />
                <ul className="space-y-2">
                  {analytics.allocation.map((slice) => (
                    <li key={slice.id}>
                      <button
                        type="button"
                        onClick={() => setActiveSlice(activeSlice === slice.name ? null : slice.name)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                          activeSlice === slice.name
                            ? 'border-lime/35 bg-lime/[0.1]'
                            : 'border-white/10 hover:bg-white/[0.05]',
                        )}
                      >
                        <span className="size-3 rounded-sm" style={{ background: slice.color }} aria-hidden />
                        <span className="text-xs font-semibold text-cream/90">{slice.name}</span>
                        <span className="text-2xs text-cream/50">{slice.zone}</span>
                        <span className="ml-auto font-mono text-xs tabular-nums text-cream/80">
                          {(slice.share * 100).toFixed(0)}%
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {activeSlice ? <ZoneDetail slice={analytics.allocation.find((s) => s.name === activeSlice)} onClose={() => setActiveSlice(null)} /> : null}
            </section>
          </div>
        </div>
      </div>
    </EarthWorkspace>
  );
}

function ZoneDetail({
  slice,
  onClose,
}: {
  slice?: { name: string; zone: string; role: string; note: string; color: string };
  onClose: () => void;
}): JSX.Element | null {
  if (!slice) return null;
  return (
    <div className="mt-3.5 rounded-lg border border-white/10 bg-black/20 p-3.5">
      <div className="flex items-center gap-2">
        <span className="size-3 rounded-sm" style={{ background: slice.color }} aria-hidden />
        <span className="text-xs font-semibold text-cream">
          {slice.name} — {slice.zone} — {slice.role}
        </span>
      </div>
      <p className="mt-1.5 text-2xs leading-relaxed text-cream/60">{slice.note}</p>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 h-7 px-2 text-2xs text-cream/60 hover:bg-white/10 hover:text-cream"
        onClick={onClose}
      >
        Close
      </Button>
    </div>
  );
}

function OutcomeCard({ label, value, note }: { label: string; value: string; note: string }): JSX.Element {
  return (
    <div className="chrome p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-3xs uppercase tracking-[0.1em] text-cream/45">{label}</p>
        <Badge variant="warning">Illustrative</Badge>
      </div>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-lime">{value}</p>
      <p className="mt-1 text-2xs leading-relaxed text-cream/50">{note}</p>
    </div>
  );
}

function WeatherStat({ label, value, sub }: { label: string; value: string; sub?: string }): JSX.Element {
  return (
    <div className="min-w-[74px]">
      <p className="text-3xs uppercase tracking-[0.1em] text-cream/45">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-cream/90">{value}</p>
      {sub ? <p className="text-[0.625rem] text-cream/45">{sub}</p> : null}
    </div>
  );
}

function ChartHeading({ title, icon: Icon }: { title: string; icon: typeof Droplets }): JSX.Element {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold text-cream">
      <Icon className="size-3.5 text-lime" aria-hidden />
      {title}
    </h2>
  );
}

function MetricCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit: string;
  hint: string;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
      <p className="text-3xs uppercase tracking-[0.1em] text-cream/45">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="font-mono text-lg font-semibold tabular-nums text-cream">{value}</span>
        <span className="text-2xs text-cream/50">{unit}</span>
      </p>
      <p className="mt-0.5 text-[0.625rem] text-cream/40">{hint}</p>
    </div>
  );
}

function ChartLegend({ items }: { items: Array<{ label: string; color: string; solid: boolean }> }): JSX.Element {
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-4">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-2xs text-cream/60">
          <svg width="20" height="8" aria-hidden>
            <line
              x1="0"
              y1="4"
              x2="20"
              y2="4"
              stroke={item.color}
              strokeWidth="2"
              strokeDasharray={item.solid ? undefined : '5 4'}
            />
          </svg>
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function DateField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-3xs uppercase tracking-[0.1em] text-cream/45">{label}</span>
      <span className="relative">
        <CalendarDays className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-cream/40" />
        <input
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 rounded-md border border-white/15 bg-white/[0.06] pl-7 pr-2 text-xs text-cream [color-scheme:dark] focus:border-lime focus:outline-none"
        />
      </span>
    </label>
  );
}
