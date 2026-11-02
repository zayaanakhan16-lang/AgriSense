import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Droplets, Gauge, Info, ShieldQuestion, Sprout, Sunrise } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { NoFieldSelected } from '@/components/common/FieldContextBar';
import { InlineNotice, SourceNote } from '@/components/common/StateBlocks';
import {
  AnalysisErrorBanner,
  FieldHeaderCard,
  PageScaffold,
  SectionCard,
  SkeletonPanel,
} from '@/components/layout/PageScaffold';
import { buildIrrigationDecision } from '@/services/decision';
import { formatDateTime } from '@/lib/format';
import { useFieldIntelligence } from '@/hooks/useFieldIntelligence';
import { cn } from '@/lib/utils';

const WEIGHT_META = {
  primary: { label: 'Driving', tone: 'border-lime/40 bg-lime/[0.07]', dot: 'bg-lime' },
  supporting: { label: 'Supporting', tone: 'border-sky-500/25 bg-sky-500/[0.05]', dot: 'bg-sky-400' },
  counter: { label: 'Counter-evidence', tone: 'border-amber-500/30 bg-amber-500/[0.06]', dot: 'bg-amber-400' },
} as const;

export default function DecisionCenterPage(): JSX.Element {
  const { field, intelligence, stages, running, completed, error, analysedAt, run } = useFieldIntelligence();
  const { vegetation, soil, climate, evaluation, planning } = intelligence;

  const decision = useMemo(() => {
    if (!field) return null;
    return buildIrrigationDecision({
      vegetation,
      soil,
      climate,
      evaluation,
      planning,
      fieldName: field.name,
    });
  }, [field, vegetation, soil, climate, evaluation, planning]);

  const hasAnySignal = Boolean(vegetation || soil || climate);

  if (!field) {
    return (
      <PageScaffold
        title="Decision Center"
        description="The 6:40 AM irrigation decision, assembled from the signals retrieved for this field."
      >
        <NoFieldSelected />
      </PageScaffold>
    );
  }

  return (
    <PageScaffold
      title="Decision Center"
      description="A single operational decision, with the evidence that supports it and the uncertainty that remains."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={run} disabled={running}>
            Refresh evidence
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

        {running && !hasAnySignal ? (
          <SectionCard title="Gathering evidence">
            <SkeletonPanel rows={5} />
          </SectionCard>
        ) : null}

        {decision ? (
          <>
            {/* -------------------------------------------------------- verdict card */}
            <div className="relative overflow-hidden rounded-xl border border-lime/30 bg-gradient-to-br from-forest-800/70 via-forest-900/70 to-forest-950/70 p-5 sm:p-6">
              <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-lime/[0.07] blur-3xl" />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-lime/15 text-lime">
                    <Sunrise className="size-4" />
                  </span>
                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-lime">
                      {decision.scenarioLabel}
                    </p>
                    <p className="mt-0.5 text-2xs text-cream/60">
                      Composed from {decision.evidence.length} retrieved signal
                      {decision.evidence.length === 1 ? '' : 's'} · {formatDateTime(decision.generatedAt)}
                    </p>
                  </div>
                  <Badge variant="lime" className="ml-auto">
                    {decision.confidenceLabel} · {Math.round(decision.confidence * 100)}%
                  </Badge>
                </div>

                <h2 className="mt-4 font-display text-lg font-semibold leading-snug text-cream sm:text-xl">
                  {decision.verdict}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-cream/75">{decision.action}</p>

                <div className="mt-5 max-w-md">
                  <div className="mb-1.5 flex items-center justify-between text-2xs text-cream/55">
                    <span className="flex items-center gap-1.5">
                      <Gauge className="size-3" />
                      Decision confidence
                    </span>
                    <span className="font-mono">{Math.round(decision.confidence * 100)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-lime-600 to-lime-400"
                      style={{ width: `${decision.confidence * 100}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-cream/50">
                    Confidence rises with the number of independent signals that resolved and how strongly they agree.
                    It is capped, so a decision built on partial data never reports certainty.
                  </p>
                </div>
              </div>
            </div>

            {decision.isIllustrative ? (
              <InlineNotice tone="warning">
                <span className="font-semibold">Partially illustrative. </span>
                Fewer than three independent signals resolved for this field, so this decision reflects the available
                evidence rather than a complete agronomic picture. Treat it as guidance to verify in the field.
              </InlineNotice>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
              <SectionCard
                title="Evidence"
                description="Every item records the provider it came from. Counter-evidence is shown, not hidden."
              >
                <ul className="space-y-2.5">
                  {decision.evidence.map((item) => {
                    const meta = WEIGHT_META[item.weight];
                    return (
                      <li key={item.id} className={cn('rounded-lg border px-3.5 py-3', meta.tone)}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
                          <span className="text-xs font-semibold">{item.label}</span>
                          <Badge variant="outline" className="ml-auto">
                            {meta.label}
                          </Badge>
                        </div>
                        <p className="mt-1.5 font-mono text-sm font-semibold tabular-nums">{item.value}</p>
                        <p className="mt-1.5 text-2xs leading-relaxed text-muted-foreground">{item.interpretation}</p>
                        <p className="mt-1.5 text-[0.625rem] uppercase tracking-[0.08em] text-muted-foreground/70">
                          {item.source}
                        </p>
                      </li>
                    );
                  })}
                </ul>
                {!decision.evidence.length ? (
                  <InlineNotice tone="warning">
                    No signals could be retrieved for this field, so no decision can be justified. Run the analysis or check
                    network access to the data providers.
                  </InlineNotice>
                ) : null}
              </SectionCard>

              <div className="space-y-4">
                <SectionCard
                  title="Uncertainty"
                  description="What is not known, stated explicitly rather than assumed."
                  actions={
                    <Badge variant={decision.uncertainty.length ? 'warning' : 'success'}>
                      {decision.uncertainty.length ? `${decision.uncertainty.length} gaps` : 'Complete'}
                    </Badge>
                  }
                >
                  {decision.uncertainty.length ? (
                    <ul className="space-y-2.5">
                      {decision.uncertainty.map((item) => (
                        <li key={item} className="flex gap-2.5 text-2xs leading-relaxed text-muted-foreground">
                          <ShieldQuestion className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <InlineNotice tone="info">
                      All decision inputs resolved for this field. The remaining uncertainty is agronomic judgement, not
                      missing data.
                    </InlineNotice>
                  )}
                </SectionCard>

                <SectionCard title="The reference scenario" description="The AgriSense walkthrough this panel is modelled on.">
                  <ul className="space-y-2.5 text-2xs leading-relaxed text-muted-foreground">
                    <li className="flex gap-2.5">
                      <Droplets className="mt-0.5 size-3.5 shrink-0 text-lime" />
                      <span>
                        <span className="font-medium text-foreground">Vegetation weakening.</span> Canopy vigour is
                        declining against the previous satellite pass.
                      </span>
                    </li>
                    <li className="flex gap-2.5">
                      <Clock className="mt-0.5 size-3.5 shrink-0 text-lime" />
                      <span>
                        <span className="font-medium text-foreground">Hot conditions forecast.</span> Near-term heat raises
                        evaporative demand and compounds stress.
                      </span>
                    </li>
                    <li className="flex gap-2.5">
                      <Info className="mt-0.5 size-3.5 shrink-0 text-lime" />
                      <span>
                        <span className="font-medium text-foreground">Moisture still stored below.</span> The deeper profile
                        retains water, so a full-field pass would waste it.
                      </span>
                    </li>
                  </ul>
                  <Separator className="my-3.5" />
                  <p className="text-2xs leading-relaxed text-muted-foreground">
                    The verdict above is generated from this field's own data. The scenario only determines which evidence
                    is asked for — never the answer.
                  </p>
                </SectionCard>
              </div>
            </div>

            <SectionCard
              title="Recommended next actions"
              description="Concrete steps that follow from the verdict, ordered by what to do first."
            >
              <ol className="space-y-2.5">
                {[
                  {
                    title: 'Scout before irrigating',
                    detail:
                      'Walk the lowest-vigour zone at first light and take a spade sample at 10 cm and 30 cm. Confirm whether the dry layer is surface-only before applying water.',
                  },
                  {
                    title: 'Irrigate the stressed strip only',
                    detail:
                      'If the profile below 20 cm is still moist, water only the zone with the weakest canopy rather than the whole field.',
                  },
                  {
                    title: 'Re-read the next satellite pass',
                    detail:
                      'Compare NDVI against the previous scene once the next low-cloud acquisition lands. A rising index after targeted irrigation confirms the call.',
                  },
                  {
                    title: 'Adjust the next planting cycle',
                    detail:
                      'If the deficit persists, shift one zone toward a lower-water crop in the rotation rather than repeating the same allocation.',
                  },
                ].map((step, index) => (
                  <li key={step.title} className="flex gap-3 rounded-lg border border-border/60 bg-muted/15 px-3.5 py-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-lime/12 font-mono text-2xs font-semibold text-lime">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{step.title}</p>
                      <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Separator className="my-3.5" />
              <SourceNote
                source={{
                  id: 'decision-composite',
                  label: 'Composite decision from retrieved signals',
                  provider: 'AgriSense decision layer',
                  note: 'Each contributing provider is recorded on its evidence item above.',
                }}
              />
            </SectionCard>
          </>
        ) : null}

        {!completed && !running && !hasAnySignal ? (
          <InlineNotice tone="info">
            No evidence has been gathered for this field yet.{' '}
            <button type="button" className="font-semibold underline" onClick={run}>
              Run the analysis
            </button>{' '}
            to populate the decision center.
          </InlineNotice>
        ) : null}
      </div>
    </PageScaffold>
  );
}
