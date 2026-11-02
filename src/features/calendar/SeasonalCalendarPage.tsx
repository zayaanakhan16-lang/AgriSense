import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Droplets, Leaf, ShieldAlert, Sprout } from 'lucide-react';
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
import { DATA_SOURCES } from '@/services/sources';
import { formatArea, monthLabel, percent } from '@/lib/format';
import { useFieldIntelligence } from '@/hooks/useFieldIntelligence';
import { CROP_PROFILES } from '@/data/cropProfiles';
import { cn } from '@/lib/utils';
import type { RotationSlot } from '@/types';

const SEASON_LABEL: Record<RotationSlot['season'], string> = {
  spring: 'Spring',
  summer: 'Summer / Kharif',
  'autumn-winter': 'Autumn–winter / Rabi',
};

const MONTHS = Array.from({ length: 12 }, (_, index) => index);

export default function SeasonalCalendarPage(): JSX.Element {
  const { field, intelligence, stages, running, completed, error, analysedAt, run } = useFieldIntelligence();
  const { planning, evaluation, climate } = intelligence;

  /** Month index → rotation slot that plants in that month. */
  const monthMap = useMemo(() => {
    const map = new Map<number, RotationSlot>();
    planning?.rotation.forEach((slot) => {
      slot.months.forEach((month) => {
        if (!map.has(month)) map.set(month, slot);
      });
    });
    return map;
  }, [planning]);

  const riskAlerts = useMemo(() => {
    const alerts: Array<{ tone: 'danger' | 'warning' | 'info'; title: string; detail: string }> = [];
    if (!planning || !evaluation) return alerts;

    const context = evaluation.fieldContext;
    if (context.waterBalanceMm !== null && context.waterBalanceMm < -150) {
      alerts.push({
        tone: 'danger',
        title: 'Structural water deficit',
        detail: `Reference evapotranspiration exceeds rainfall by ${Math.abs(Math.round(context.waterBalanceMm))} mm across the record. Every high-demand slot in the rotation needs a confirmed water source.`,
      });
    }
    const highWater = planning.zones.filter((zone) => zone.waterNeedMm > 650);
    if (highWater.length) {
      alerts.push({
        tone: 'warning',
        title: 'High-demand zone concentration',
        detail: `${highWater.map((z) => z.cropName).join(', ')} require more than 650 mm. Schedule irrigation against these zones first and consider shifting one to a lower-water crop next cycle.`,
      });
    }
    if (context.meanNdvi !== null && context.meanNdvi < 0.4) {
      alerts.push({
        tone: 'warning',
        title: 'Weak canopy at planning time',
        detail: `Mean NDVI of ${context.meanNdvi.toFixed(2)} indicates the field is not carrying a vigorous canopy. Establish the rotation on soil moisture status rather than the calendar alone.`,
      });
    }
    const frosty = climate?.days.filter((day) => (day.tempMinC ?? 99) < 0).length ?? 0;
    if (frosty > 0) {
      alerts.push({
        tone: 'info',
        title: 'Frost exposure in the record',
        detail: `${frosty} day${frosty === 1 ? '' : 's'} fell below 0 °C in the trailing 12 months. Avoid scheduling frost-sensitive species in those months.`,
      });
    }
    const failed = planning.aiPlan.guardrails.filter((check) => !check.passed);
    if (failed.length) {
      alerts.push({
        tone: 'danger',
        title: 'Guardrail warnings on this plan',
        detail: failed.map((check) => `${check.label}: ${check.detail}`).join(' '),
      });
    }
    return alerts;
  }, [planning, evaluation, climate]);

  if (!field) {
    return (
      <PageScaffold
        title="Seasonal Calendar"
        description="Spring, summer and autumn–winter crop rotation across the year, with water guidance and risk alerts."
      >
        <NoFieldSelected />
      </PageScaffold>
    );
  }

  return (
    <PageScaffold
      title="Seasonal Calendar"
      description="Rotation sequencing derived from each crop's planting window and the rules-engine ranking."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={run} disabled={running}>
            Rebuild calendar
          </Button>
          <Button asChild variant="lime" size="sm">
            <Link to="/reports">
              Export report
            </Link>
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-4 sm:p-6">
        <FieldHeaderCard field={field} analysedAt={analysedAt} onRefresh={run} refreshing={running} stages={stages} />

        {error ? <AnalysisErrorBanner message={error} onRetry={run} /> : null}

        {running && !planning ? (
          <SectionCard title="Building rotation calendar">
            <SkeletonPanel rows={5} />
          </SectionCard>
        ) : null}

        {!planning && !running ? (
          <UnavailableState
            title="Rotation calendar unavailable"
            message="The rotation is built from rules-engine candidates. Run the analysis to generate approved crops, then rebuild the calendar."
            source={DATA_SOURCES.rulesEngine.label}
          />
        ) : null}

        {planning ? (
          <>
            <SectionCard
              title="Twelve-month rotation grid"
              description="Coloured months show the planting window of each scheduled slot. Dots mark typical harvest months."
              bodyClassName="p-4 sm:p-5"
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {MONTHS.map((month) => {
                  const slot = monthMap.get(month);
                  const crop = slot ? CROP_PROFILES.find((c) => c.id === slot.cropId) : undefined;
                  const isHarvest = crop?.harvestMonths.includes(month) ?? false;
                  return (
                    <div
                      key={month}
                      className={cn(
                        'relative overflow-hidden rounded-lg border px-3 py-2.5 transition-colors',
                        slot ? 'border-white/10' : 'border-border/60 bg-muted/15',
                      )}
                      style={slot ? { backgroundColor: `${slot.color}1F`, borderColor: `${slot.color}55` } : undefined}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-2xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                          {monthLabel(month)}
                        </span>
                        {isHarvest ? (
                          <span className="size-1.5 rounded-full bg-amber-400" title="Typical harvest month" />
                        ) : null}
                      </div>
                      {slot ? (
                        <>
                          <p className="mt-1.5 truncate text-xs font-semibold" style={{ color: slot.color }}>
                            {slot.cropName}
                          </p>
                          <p className="mt-0.5 text-[0.625rem] text-muted-foreground">
                            {Math.round(slot.waterMm)} mm demand
                          </p>
                        </>
                      ) : (
                        <p className="mt-1.5 text-2xs text-muted-foreground">Fallow / intercrop</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <Separator className="my-4" />
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-2xs text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-lime/30" /> Planting window
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-amber-400" /> Typical harvest month
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm border border-border" /> Fallow period
                </li>
              </ul>
            </SectionCard>

            <div className="grid gap-4 lg:grid-cols-3">
              {planning.rotation.map((slot) => {
                const crop = CROP_PROFILES.find((c) => c.id === slot.cropId);
                return (
                  <SectionCard
                    key={slot.season}
                    title={SEASON_LABEL[slot.season]}
                    description={`Planting months: ${slot.months.map((m) => monthLabel(m)).join(', ')}`}
                    actions={<Badge variant="lime" style={{ borderColor: `${slot.color}66`, color: slot.color }}>{slot.cropName}</Badge>}
                  >
                    <ul className="space-y-2.5 text-2xs">
                      <li className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Water demand</span>
                        <span className="font-mono tabular-nums">{Math.round(slot.waterMm)} mm</span>
                      </li>
                      {crop ? (
                        <>
                          <li className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">Cycle length</span>
                            <span className="font-mono tabular-nums">{crop.cycleDays} days</span>
                          </li>
                          <li className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">Drought tolerance</span>
                            <span className="font-mono capitalize">{crop.droughtTolerance}</span>
                          </li>
                          <li className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">Drainage need</span>
                            <span className="font-mono capitalize">{crop.drainageNeed}</span>
                          </li>
                          <li className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">Harvest months</span>
                            <span className="font-mono">{crop.harvestMonths.map((m) => monthLabel(m)).join(', ')}</span>
                          </li>
                        </>
                      ) : null}
                    </ul>
                    <Separator className="my-3" />
                    <p className="text-2xs leading-relaxed text-muted-foreground">{slot.note}</p>
                  </SectionCard>
                );
              })}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <SectionCard
                title="Water management guidance"
                description="Derived from zone demand, the rainfall record and reference evapotranspiration."
              >
                <div className="grid grid-cols-2 gap-2.5">
                  <MetricTile
                    label="Total rotation demand"
                    value={String(Math.round(planning.rotation.reduce((acc, slot) => acc + slot.waterMm, 0)))}
                    unit="mm"
                    sub={`across ${planning.rotation.length} slots`}
                  />
                  <MetricTile
                    label="Annual rainfall"
                    value={evaluation?.fieldContext.annualRainfallMm !== null && evaluation?.fieldContext.annualRainfallMm !== undefined ? String(Math.round(evaluation.fieldContext.annualRainfallMm)) : '—'}
                    unit="mm"
                    sub="trailing 12 months"
                    tone={evaluation?.fieldContext.annualRainfallMm === null ? 'muted' : 'default'}
                  />
                </div>
                <Separator className="my-3.5" />
                <ul className="space-y-2.5">
                  {planning.zones.map((zone) => (
                    <li key={zone.id} className="flex items-start gap-2.5">
                      <span className="mt-0.5 size-3 shrink-0 rounded-sm" style={{ background: zone.color }} aria-hidden />
                      <div className="min-w-0">
                        <p className="text-2xs font-semibold">
                          {zone.cropName}
                          <span className="ml-2 font-mono font-normal text-muted-foreground">
                            {percent(zone.share, 0)} of area · {formatArea(zone.areaM2)}
                          </span>
                        </p>
                        <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                          {zone.waterNeedMm > 650
                            ? 'High water demand — prioritise this zone for any irrigation allocation.'
                            : zone.waterNeedMm > 450
                              ? 'Moderate demand — supplemental irrigation in dry spells only.'
                              : 'Low demand — should draw primarily on stored soil moisture.'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard
                title="Risk alerts"
                description="Raised only from signals that were actually retrieved for this field."
                actions={<Badge variant={riskAlerts.length ? 'warning' : 'success'}>{riskAlerts.length || 'None'}</Badge>}
              >
                {riskAlerts.length ? (
                  <ul className="space-y-2.5">
                    {riskAlerts.map((alert) => (
                      <li
                        key={alert.title}
                        className={cn(
                          'rounded-lg border px-3.5 py-2.5',
                          alert.tone === 'danger'
                            ? 'border-red-500/30 bg-red-500/[0.06]'
                            : alert.tone === 'warning'
                              ? 'border-amber-500/30 bg-amber-500/[0.06]'
                              : 'border-sky-500/25 bg-sky-500/[0.05]',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <ShieldAlert
                            className={cn(
                              'size-3.5 shrink-0',
                              alert.tone === 'danger' ? 'text-red-400' : alert.tone === 'warning' ? 'text-amber-400' : 'text-sky-400',
                            )}
                          />
                          <p className="text-2xs font-semibold">{alert.title}</p>
                        </div>
                        <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">{alert.detail}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <InlineNotice tone="info">
                    No risk alerts were raised. Water balance, zone demand, canopy condition and guardrail checks are all
                    within expected bounds.
                  </InlineNotice>
                )}
              </SectionCard>
            </div>

            <SectionCard
              title="Crop-specific recommendations per season"
              description="Practical guidance attached to each rotation slot."
            >
              <div className="grid gap-3 lg:grid-cols-3">
                {planning.rotation.map((slot) => {
                  const crop = CROP_PROFILES.find((c) => c.id === slot.cropId);
                  return (
                    <div key={slot.season} className="rounded-lg border border-border/60 bg-muted/15 p-3.5">
                      <div className="flex items-center gap-2">
                        <Leaf className="size-3.5" style={{ color: slot.color }} />
                        <span className="text-xs font-semibold">{slot.cropName}</span>
                        <span className="ml-auto text-2xs text-muted-foreground">{SEASON_LABEL[slot.season]}</span>
                      </div>
                      <ul className="mt-2.5 space-y-2 text-2xs leading-relaxed text-muted-foreground">
                        <li className="flex gap-2">
                          <Droplets className="mt-0.5 size-3 shrink-0 text-lime" />
                          <span>
                            Target {crop ? `${crop.waterRequirementMm.min}–${crop.waterRequirementMm.max} mm` : `${Math.round(slot.waterMm)} mm`}{' '}
                            across the cycle. Split applications rather than a single pass.
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <Sprout className="mt-0.5 size-3 shrink-0 text-lime" />
                          <span>
                            {crop ? crop.notes : 'Follow the rules-engine rationale for this slot.'}
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <CalendarDays className="mt-0.5 size-3 shrink-0 text-lime" />
                          <span>
                            Plant in {slot.months.map((m) => monthLabel(m)).join(', ')}; harvest from{' '}
                            {crop ? crop.harvestMonths.map((m) => monthLabel(m)).join(', ') : 'the end of the cycle'}.
                          </span>
                        </li>
                      </ul>
                    </div>
                  );
                })}
              </div>
              <Separator className="my-3.5" />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <SourceNote source={DATA_SOURCES.rulesEngine} />
                <SourceNote source={DATA_SOURCES.rulesDataset} />
              </div>
            </SectionCard>
          </>
        ) : null}

        {!completed && !running && !planning ? (
          <InlineNotice tone="info">
            The calendar is not built for this field yet.{' '}
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
