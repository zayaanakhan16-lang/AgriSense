import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Ban,
  ArrowUpDown,
  Search,
  Bot,
  CheckCircle2,
  Filter,
  Layers,
  ListChecks,
  ShieldCheck,
  Sliders,
  Sprout,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { NoFieldSelected } from '@/components/common/FieldContextBar';
import { DemoNotice, InlineNotice, SourceNote, UnavailableState } from '@/components/common/StateBlocks';
import {
  AnalysisErrorBanner,
  FieldHeaderCard,
  MetricTile,
  SectionCard,
  SkeletonPanel,
} from '@/components/layout/PageScaffold';
import { EarthMap } from '@/components/map/EarthMap';
import { AllocationDonut, FactorRadar } from '@/components/charts/Charts';
import { DATA_SOURCES } from '@/services/sources';
import { CROP_DATASET_META, WATER_CLASS_LABELS } from '@/data/cropProfiles';
import { FACTOR_WEIGHTS, RULES_ENGINE_META, VERDICT_THRESHOLDS } from '@/services/rulesEngine';
import { formatArea, formatNumber, percent } from '@/lib/format';
import { useFieldIntelligence } from '@/hooks/useFieldIntelligence';
import { cn } from '@/lib/utils';
import type { CropEvaluation, SuitabilityVerdict } from '@/types';

const VERDICT_META: Record<SuitabilityVerdict, { label: string; variant: 'success' | 'info' | 'danger'; tone: string }> = {
  recommended: { label: 'Recommended', variant: 'success', tone: 'text-lime-300' },
  conditional: { label: 'Conditional', variant: 'info', tone: 'text-sky-300' },
  rejected: { label: 'Rejected', variant: 'danger', tone: 'text-red-300' },
};

const FACTOR_LABELS: Record<string, string> = {
  water: 'Water requirement',
  climate: 'Climate compatibility',
  season: 'Seasonal suitability',
  ph: 'Soil pH fit',
  texture: 'Soil texture match',
};

export default function CropPlanningPage(): JSX.Element {
  return <CropSuitability embedded={false} />;
}

/**
 * Rules-engine crop suitability comparison.
 *
 * `embedded` drops the standalone page chrome so the crop workspace can stack
 * this below the crop-profile map on one continuous page.
 */
export function CropSuitability({ embedded }: { embedded: boolean }): JSX.Element {
  const { field, intelligence, stages, running, completed, error, analysedAt, run } = useFieldIntelligence();
  const { evaluation, planning } = intelligence;
  const [verdictFilter, setVerdictFilter] = useState<'all' | SuitabilityVerdict>('all');
  const [selectedCropId, setSelectedCropId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<'score' | 'name' | 'water'>('score');

  const filtered = useMemo(() => {
    if (!evaluation) return [];
    const term = query.trim().toLowerCase();
    const base = verdictFilter === 'all'
      ? evaluation.evaluations
      : evaluation.evaluations.filter((entry) => entry.verdict === verdictFilter);
    const searched = term
      ? base.filter(
          (entry) =>
            entry.crop.name.toLowerCase().includes(term) ||
            (entry.crop.scientificName?.toLowerCase().includes(term) ?? false),
        )
      : base;
    const sorted = [...searched];
    sorted.sort((a, b) => {
      if (sortKey === 'name') return a.crop.name.localeCompare(b.crop.name);
      if (sortKey === 'water') {
        const wa = (a.crop.waterRequirementMm.min + a.crop.waterRequirementMm.max) / 2;
        const wb = (b.crop.waterRequirementMm.min + b.crop.waterRequirementMm.max) / 2;
        return wa - wb;
      }
      return b.score - a.score;
    });
    return sorted;
  }, [evaluation, verdictFilter, query, sortKey]);

  const selected = useMemo(() => {
    if (!evaluation) return null;
    return evaluation.evaluations.find((entry) => entry.crop.id === selectedCropId) ?? evaluation.evaluations[0] ?? null;
  }, [evaluation, selectedCropId]);

  const donutData = useMemo(() => {
    if (!planning) return [];
    return planning.zones.map((zone) => ({ name: zone.cropName, value: zone.share, color: zone.color }));
  }, [planning]);

  const radarData = useMemo(() => {
    if (!selected) return [];
    return selected.factors.map((factor) => ({
      factor: FACTOR_LABELS[factor.id]?.split(' ')[0] ?? factor.id,
      score: Number(factor.score.toFixed(3)),
    }));
  }, [selected]);

  if (!field) {
    return (
      <Scaffold embedded={embedded} title="Crop Planning" description="The deterministic rules engine decides which crops are acceptable before any AI explanation.">
        <NoFieldSelected />
      </Scaffold>
    );
  }

  const context = evaluation?.fieldContext;

  return (
    <Scaffold
      embedded={embedded}
      title="Crop Planning"
      description="Rules engine first, AI explanation second. The model never introduces a crop the engine has not approved."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={run} disabled={running}>
            Re-evaluate
          </Button>
          <Button asChild variant="lime" size="sm">
            <Link to="/studio">
              Create crop plan
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-4 sm:p-6">
        <FieldHeaderCard field={field} analysedAt={analysedAt} onRefresh={run} refreshing={running} stages={stages} />

        {error ? <AnalysisErrorBanner message={error} onRetry={run} /> : null}

        {/* ------------------------------------------------------- workflow diagram */}
        <SectionCard
          title="How a plan is produced"
          description="The rules engine gates every crop. The language model only explains what the engine already approved."
        >
          <ol className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
            {[
              { label: 'Field signals', detail: 'NDVI, soil, climate and boundary', icon: Layers, tone: 'neutral' },
              { label: `${evaluation?.datasetSize ?? 68}-crop rules engine`, detail: `Deterministic scoring v${RULES_ENGINE_META.version}`, icon: Sliders, tone: 'engine' },
              { label: 'Approved candidates', detail: `${evaluation ? evaluation.recommended.length + evaluation.conditional.length : 0} passed the thresholds`, icon: Filter, tone: 'approved' },
              { label: 'AI explanation', detail: 'Narrative only — no selection', icon: Bot, tone: 'ai' },
              { label: 'Guardrail validation', detail: 'Deterministic consistency checks', icon: ShieldCheck, tone: 'guard' },
              { label: 'Zones, rotation, recommendations', detail: 'Allocation and calendar', icon: ListChecks, tone: 'output' },
            ].map((step, index, all) => (
              <li key={step.label} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    'flex w-full flex-col gap-1.5 rounded-lg border px-3 py-2.5',
                    step.tone === 'engine' && 'border-lime/40 bg-lime/[0.07]',
                    step.tone === 'approved' && 'border-emerald-500/30 bg-emerald-500/[0.06]',
                    step.tone === 'ai' && 'border-sky-500/25 bg-sky-500/[0.05]',
                    step.tone === 'guard' && 'border-amber-500/25 bg-amber-500/[0.05]',
                    step.tone === 'output' && 'border-border bg-muted/25',
                    step.tone === 'neutral' && 'border-border/70 bg-muted/15',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <step.icon className="size-3.5 shrink-0 text-lime" />
                    <span className="text-2xs font-semibold uppercase tracking-[0.06em]">{step.label}</span>
                  </div>
                  <span className="text-[0.6875rem] leading-relaxed text-muted-foreground">{step.detail}</span>
                </div>
                {index < all.length - 1 ? (
                  <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground/50 lg:block" />
                ) : null}
              </li>
            ))}
          </ol>
          <Separator className="my-3.5" />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-2xs text-muted-foreground">
            <span>
              Acceptance threshold: <span className="font-mono text-foreground">{Math.round(VERDICT_THRESHOLDS.recommended * 100)}</span> recommended ·{' '}
              <span className="font-mono text-foreground">{Math.round(VERDICT_THRESHOLDS.conditional * 100)}</span> conditional
            </span>
            <span>
              Weights:{' '}
              {Object.entries(FACTOR_WEIGHTS).map(([key, weight], index) => (
                <span key={key}>
                  {index > 0 ? ' · ' : ''}
                  {FACTOR_LABELS[key] ?? key} <span className="font-mono text-foreground">{weight}</span>
                </span>
              ))}
            </span>
          </div>
        </SectionCard>

        {CROP_DATASET_META.isDemonstration ? (
          <DemoNotice>
            The rules engine is running against the bundled {CROP_DATASET_META.size}-crop demonstration profile set. Every
            score below is computed deterministically from your field's real NDVI, soil and climate signals, but the crop
            reference values themselves are demonstration data. Connect a rules-engine service with{' '}
            <span className="font-mono">VITE_AGRISENSE_API_URL</span> to use production profiles.
          </DemoNotice>
        ) : null}

        {running && !evaluation ? (
          <SectionCard title="Evaluating crop suitability">
            <SkeletonPanel rows={6} />
            <p className="mt-3 text-2xs text-muted-foreground">
              Scoring every profile against water, climate, season, pH and texture rules.
            </p>
          </SectionCard>
        ) : null}

        {!evaluation && !running ? (
          <UnavailableState
            title="Rules-engine evaluation unavailable"
            message="The crop suitability evaluation has not run for this field. Run the analysis to score the crop profiles against this field's signals."
            source={DATA_SOURCES.rulesEngine.label}
          />
        ) : null}

        {evaluation && planning ? (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <MetricTile
                label="Profiles evaluated"
                value={String(evaluation.datasetSize)}
                sub={`engine v${evaluation.engineVersion}`}
              />
              <MetricTile
                label="Recommended"
                value={String(evaluation.recommended.length)}
                sub={`score ≥ ${Math.round(VERDICT_THRESHOLDS.recommended * 100)}`}
                tone="positive"
              />
              <MetricTile
                label="Conditional"
                value={String(evaluation.conditional.length)}
                sub={`score ${Math.round(VERDICT_THRESHOLDS.conditional * 100)}–${Math.round(VERDICT_THRESHOLDS.recommended * 100)}`}
                tone="warning"
              />
              <MetricTile
                label="Rejected"
                value={String(evaluation.rejected.length)}
                sub={`below ${Math.round(VERDICT_THRESHOLDS.conditional * 100)}`}
                tone="danger"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              {/* ------------------------------------------------------ crop table */}
              <SectionCard
                title="Crop suitability comparison"
                description="Deterministic scores. Select a crop to see its factor breakdown."
                bodyClassName="p-0"
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search crop or species"
                        className="h-8 w-[190px] pl-7 text-xs"
                        aria-label="Search crops"
                      />
                    </div>
                    <Select value={sortKey} onValueChange={(value) => setSortKey(value as typeof sortKey)}>
                      <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="Sort crops">
                        <ArrowUpDown className="mr-1 size-3.5" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="score">Score</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="water">Water need</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={verdictFilter} onValueChange={(value) => setVerdictFilter(value as typeof verdictFilter)}>
                      <SelectTrigger className="h-8 w-[150px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All {evaluation.datasetSize}</SelectItem>
                        <SelectItem value="recommended">Recommended</SelectItem>
                        <SelectItem value="conditional">Conditional</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                }
              >
                <div className="max-h-[440px] overflow-y-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-card">
                      <tr className="border-b border-border/70 text-left">
                        <th className="px-4 py-2.5 font-semibold">Crop</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Score</th>
                        <th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Water</th>
                        <th className="hidden px-3 py-2.5 font-semibold md:table-cell">Soil</th>
                        <th className="hidden px-3 py-2.5 font-semibold md:table-cell">Climate</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Verdict</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((entry) => {
                        const meta = VERDICT_META[entry.verdict];
                        const isSelected = selected?.crop.id === entry.crop.id;
                        const ph = entry.factors.find((f) => f.id === 'ph');
                        const climate = entry.factors.find((f) => f.id === 'climate');
                        return (
                          <tr
                            key={entry.crop.id}
                            onClick={() => setSelectedCropId(entry.crop.id)}
                            className={cn(
                              'cursor-pointer border-b border-border/40 transition-colors last:border-b-0',
                              isSelected ? 'bg-lime/[0.07]' : 'hover:bg-muted/30',
                            )}
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className={cn('size-1.5 rounded-full', isSelected ? 'bg-lime' : 'bg-transparent')} />
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{entry.crop.name}</div>
                                  <div className="truncate text-2xs italic text-muted-foreground">
                                    {entry.crop.scientificName}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span className="font-mono text-sm font-semibold tabular-nums">
                                {Math.round(entry.score * 100)}
                              </span>
                            </td>
                            <td className="hidden px-3 py-2.5 sm:table-cell">
                              <span className="text-2xs text-muted-foreground">
                                {WATER_CLASS_LABELS[entry.crop.waterClass]}
                                <span className="ml-1 font-mono">
                                  {entry.crop.waterRequirementMm.min}–{entry.crop.waterRequirementMm.max}
                                </span>
                              </span>
                            </td>
                            <td className="hidden px-3 py-2.5 md:table-cell">
                              <span className="text-2xs text-muted-foreground">
                                {entry.crop.soilTextures.slice(0, 2).join(', ')}
                              </span>
                            </td>
                            <td className="hidden px-3 py-2.5 md:table-cell">
                              <span className={cn('font-mono text-2xs', (climate?.score ?? 0) >= 0.7 ? 'text-lime-300' : 'text-amber-300')}>
                                {Math.round((climate?.score ?? 0) * 100)}%
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <Badge variant={meta.variant}>{meta.label}</Badge>
                            </td>
                            <td className="hidden">
                              <span>{ph?.score}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-border/60 px-4 py-2.5">
                  <p className="text-2xs text-muted-foreground">
                    Showing {filtered.length} of {evaluation.datasetSize} profiles. Scores are reproducible: the same field
                    context always yields the same ranking.
                  </p>
                </div>
              </SectionCard>

              {/* --------------------------------------------------- selected detail */}
              <div className="space-y-4">
                {selected ? (
                  <SectionCard
                    title={selected.crop.name}
                    description={selected.crop.scientificName}
                    actions={<Badge variant={VERDICT_META[selected.verdict].variant}>{Math.round(selected.score * 100)}/100</Badge>}
                  >
                    <FactorRadar data={radarData} height={190} />
                    <Separator className="my-3.5" />
                    <ul className="space-y-2">
                      {selected.factors.map((factor) => (
                        <li key={factor.id} className="flex items-start gap-2.5">
                          {factor.verdict === 'pass' ? (
                            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-lime" />
                          ) : factor.verdict === 'marginal' ? (
                            <Ban className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                          ) : (
                            <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-400" />
                          )}
                          <div className="min-w-0">
                            <p className="text-2xs font-semibold">
                              {FACTOR_LABELS[factor.id] ?? factor.id}
                              <span className="ml-2 font-mono font-normal text-muted-foreground">
                                {Math.round(factor.score * 100)}% · weight {factor.weight}
                              </span>
                            </p>
                            <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">{factor.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <Separator className="my-3.5" />
                    <p className="text-2xs leading-relaxed text-muted-foreground">{selected.rationale}</p>
                  </SectionCard>
                ) : null}

                {planning ? (
                  <SectionCard title="Crop allocation" description="Area share assigned by rules-engine score.">
                    <AllocationDonut data={donutData} height={180} />
                    <ul className="mt-3 space-y-1.5">
                      {planning.zones.map((zone) => (
                        <li key={zone.id} className="flex items-center gap-2 text-2xs">
                          <span className="size-2.5 rounded-sm" style={{ background: zone.color }} aria-hidden />
                          <span className="font-medium">{zone.cropName}</span>
                          <span className="ml-auto font-mono tabular-nums">{percent(zone.share, 1)}</span>
                          <span className="font-mono text-muted-foreground">{formatArea(zone.areaM2)}</span>
                        </li>
                      ))}
                    </ul>
                  </SectionCard>
                ) : null}
              </div>
            </div>

            {/* ----------------------------------------------------- zones + AI plan */}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <SectionCard
                title="Field zoning"
                description="The drawn boundary partitioned into proportional crop zones."
                bodyClassName="p-0"
                actions={<Badge variant="outline">{planning.zones.length} zones</Badge>}
              >
                <div className="h-[340px] overflow-hidden border-y border-border/60">
                  <EarthMap
                    fieldCoords={field.boundary.coords}
                    zones={planning.zones}
                    markers={planning.zones.map((zone) => ({ coord: zone.centroid, color: zone.color, radius: 5 }))}
                    compact
                    className="size-full"
                  />
                </div>
                <ul className="divide-y divide-border/50">
                  {planning.zones.map((zone) => (
                    <li key={zone.id} className="flex items-start gap-3 px-4 py-3">
                      <span className="mt-0.5 size-3 shrink-0 rounded-sm" style={{ background: zone.color }} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold">{zone.cropName}</span>
                          <Badge variant={VERDICT_META[zone.verdict].variant}>{VERDICT_META[zone.verdict].label}</Badge>
                          <span className="font-mono text-2xs text-muted-foreground">{formatArea(zone.areaM2)}</span>
                          <span className="font-mono text-2xs text-muted-foreground">
                            {Math.round(zone.waterNeedMm)} mm demand
                          </span>
                        </div>
                        <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">{zone.rationale}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <div className="space-y-4">
                <SectionCard
                  title="AI explanation"
                  description="Explains the approved plan. It cannot add or remove candidates."
                  actions={
                    <Badge variant={planning.aiPlan.status === 'ok' ? 'success' : 'muted'}>
                      {planning.aiPlan.status === 'ok' ? 'Connected' : 'Not connected'}
                    </Badge>
                  }
                >
                  {planning.aiPlan.status === 'ok' && planning.aiPlan.narrative ? (
                    <div className="space-y-3">
                      <p className="font-display text-sm font-semibold">{planning.aiPlan.narrative.headline}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{planning.aiPlan.narrative.summary}</p>
                      <ul className="space-y-1.5">
                        {planning.aiPlan.narrative.reasoning.map((line, index) => (
                          <li key={index} className="flex gap-2 text-2xs leading-relaxed text-muted-foreground">
                            <span className="font-mono text-lime">{index + 1}</span>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                      <SourceNote source={{ ...DATA_SOURCES.aiExplainer, label: `${planning.aiPlan.provider} ${planning.aiPlan.model}` }} />
                    </div>
                  ) : (
                    <UnavailableState
                      title="No AI explanation connected"
                      message={
                        planning.aiPlan.message ??
                        'The explanation layer is not configured. The plan above is entirely rules-engine derived.'
                      }
                      source={DATA_SOURCES.aiExplainer.label}
                    />
                  )}
                </SectionCard>

                <SectionCard
                  title="Guardrail validation"
                  description="Deterministic checks on the produced plan."
                  actions={
                    <Badge variant={planning.aiPlan.guardrailsPassed ? 'success' : 'warning'}>
                      {planning.aiPlan.guardrails.filter((c) => c.passed).length}/{planning.aiPlan.guardrails.length} passed
                    </Badge>
                  }
                >
                  <ul className="space-y-2.5">
                    {planning.aiPlan.guardrails.map((check) => (
                      <li key={check.id} className="flex items-start gap-2.5">
                        {check.passed ? (
                          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-lime" />
                        ) : (
                          <Ban className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                        )}
                        <div className="min-w-0">
                          <p className="text-2xs font-semibold">{check.label}</p>
                          <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">{check.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              </div>
            </div>

            {/* ------------------------------------------------- recommendations */}
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard
                title="Rules-derived recommendations"
                description="Generated by the deterministic engine, not by the language model."
              >
                <ul className="space-y-2.5">
                  {planning.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex gap-2.5 rounded-lg border border-border/60 bg-muted/15 px-3.5 py-2.5">
                      <Sprout className="mt-0.5 size-3.5 shrink-0 text-lime" />
                      <p className="text-2xs leading-relaxed">{recommendation}</p>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard
                title="Rejected crops and why"
                description="Every rejection records the rule that failed."
              >
                {evaluation.rejected.length ? (
                  <Accordion type="multiple" className="w-full">
                    {evaluation.rejected.slice(0, 12).map((entry) => (
                      <AccordionItem key={entry.crop.id} value={entry.crop.id}>
                        <AccordionTrigger className="py-2.5 text-xs">
                          <span className="flex items-center gap-2">
                            <span className="font-medium">{entry.crop.name}</span>
                            <Badge variant="danger">{Math.round(entry.score * 100)}</Badge>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="mb-2 text-2xs leading-relaxed text-muted-foreground">{entry.rationale}</p>
                          {entry.constraints.length ? (
                            <ul className="space-y-1.5">
                              {entry.constraints.map((constraint, index) => (
                                <li key={index} className="flex gap-2 text-2xs leading-relaxed text-amber-200/90">
                                  <XCircle className="mt-0.5 size-3 shrink-0" />
                                  <span>{constraint}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <InlineNotice tone="info">
                    No crops were rejected for this field — every evaluated profile cleared the acceptance threshold.
                  </InlineNotice>
                )}
              </SectionCard>
            </div>

            {/* ------------------------------------------------ field context used */}
            {context ? (
              <SectionCard
                title="Field context used by the rules engine"
                description="The exact inputs that produced the scores above. Missing signals are shown as unavailable."
              >
                <Tabs defaultValue="signals">
                  <TabsList>
                    <TabsTrigger value="signals">Signals</TabsTrigger>
                    <TabsTrigger value="missing">Missing inputs</TabsTrigger>
                  </TabsList>
                  <TabsContent value="signals">
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                      <MetricTile label="Area" value={formatArea(context.areaM2)} sub={`${(context.areaM2 / 10000).toFixed(3)} ha`} />
                      <MetricTile
                        label="Mean NDVI"
                        value={context.meanNdvi !== null ? context.meanNdvi.toFixed(3) : '—'}
                        sub={context.meanNdvi === null ? 'vegetation unavailable' : 'Sentinel-2 derived'}
                        tone={context.meanNdvi === null ? 'muted' : 'default'}
                      />
                      <MetricTile
                        label="Soil pH"
                        value={context.soilPh !== null ? context.soilPh.toFixed(2) : '—'}
                        sub={context.soilPh === null ? 'soil unavailable' : '0–5 cm'}
                        tone={context.soilPh === null ? 'muted' : 'default'}
                      />
                      <MetricTile
                        label="Organic carbon"
                        value={context.organicCarbon !== null ? formatNumber(context.organicCarbon, 1) : '—'}
                        unit="g/kg"
                        tone={context.organicCarbon === null ? 'muted' : 'default'}
                      />
                      <MetricTile
                        label="Texture class"
                        value={context.textureLabel ?? '—'}
                        tone={context.textureLabel ? 'default' : 'muted'}
                      />
                      <MetricTile
                        label="Clay / sand"
                        value={
                          context.clayFraction !== null && context.sandFraction !== null
                            ? `${context.clayFraction.toFixed(0)} / ${context.sandFraction.toFixed(0)}`
                            : '—'
                        }
                        unit="%"
                        tone={context.clayFraction === null ? 'muted' : 'default'}
                      />
                      <MetricTile
                        label="Annual rainfall"
                        value={context.annualRainfallMm !== null ? Math.round(context.annualRainfallMm).toString() : '—'}
                        unit="mm"
                        tone={context.annualRainfallMm === null ? 'muted' : 'default'}
                      />
                      <MetricTile
                        label="Water balance"
                        value={context.waterBalanceMm !== null ? formatNumber(context.waterBalanceMm, 0) : '—'}
                        unit="mm"
                        sub={context.waterBalanceMm !== null && context.waterBalanceMm < 0 ? 'deficit' : context.waterBalanceMm !== null ? 'surplus' : 'climate unavailable'}
                        tone={context.waterBalanceMm === null ? 'muted' : context.waterBalanceMm < 0 ? 'warning' : 'positive'}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="missing">
                    {(() => {
                      const missing: string[] = [];
                      if (context.meanNdvi === null) missing.push('Vegetation index (NDVI) — water and crop-stress rules ran with reduced confidence.');
                      if (context.soilPh === null) missing.push('Soil pH — nutrient availability and pH-fit rules could not be evaluated.');
                      if (context.textureLabel === null) missing.push('Soil texture — root-zone suitability could not be matched.');
                      if (context.annualRainfallMm === null) missing.push('Rainfall history — irrigation deficit could not be quantified.');
                      if (context.tempMinC === null || context.tempMaxC === null) missing.push('Temperature history — climate compatibility was not verified.');
                      if (!missing.length) {
                        return (
                          <InlineNotice tone="info">
                            All required signals were available. Every rule in the engine was evaluated with real data.
                          </InlineNotice>
                        );
                      }
                      return (
                        <ul className="space-y-2">
                          {missing.map((item) => (
                            <li
                              key={item}
                              className="flex gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-2.5 text-2xs leading-relaxed text-amber-100"
                            >
                              <Ban className="mt-0.5 size-3.5 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                  </TabsContent>
                </Tabs>
              </SectionCard>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <SourceNote source={DATA_SOURCES.rulesEngine} />
              <SourceNote source={DATA_SOURCES.rulesDataset} />
              <span className="text-2xs text-muted-foreground">
                Evaluated {new Date(evaluation.evaluatedAt).toLocaleString('en-GB')}
              </span>
            </div>
          </>
        ) : null}

        {!completed && !running && !evaluation ? (
          <InlineNotice tone="info">
            Crop planning has not run for this field yet.{' '}
            <button type="button" className="font-semibold underline" onClick={run}>
              Run the analysis
            </button>
            .
          </InlineNotice>
        ) : null}
      </div>
    </Scaffold>
  );
}

/** Page chrome that collapses to a plain block when embedded in the crop workspace. */
function Scaffold({
  embedded,
  title,
  description,
  actions,
  children,
}: {
  embedded: boolean;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3.5 sm:px-6">
      <div className="min-w-0">
        <h2 className="font-display text-base font-semibold leading-tight">{title}</h2>
        <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );

  if (embedded) {
    return (
      <section className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
        {header}
        {children}
      </section>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

export type { CropEvaluation };
