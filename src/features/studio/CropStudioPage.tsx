import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  GitBranch,
  Layers,
  Plus,
  RotateCcw,
  Save,
  Scissors,
  Trash2,
  Undo2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NoFieldSelected } from '@/components/common/FieldContextBar';
import { DemoNotice, InlineNotice, UnavailableState } from '@/components/common/StateBlocks';
import { MetricTile, PageScaffold, SectionCard } from '@/components/layout/PageScaffold';
import { AllocationDonut } from '@/components/charts/Charts';
import { AllocationBar } from '@/components/map/AllocationBar';
import { EarthMap } from '@/components/map/EarthMap';
import { useFieldIntelligence } from '@/hooks/useFieldIntelligence';
import { CROP_DATASET_META } from '@/data/cropProfiles';
import { usePlanStore, normaliseShares, type PlanZoneSpec } from '@/store/planStore';
import {
  buildStudioZones,
  meanSuitability,
  weightedWaterMm,
  zonesContainedByField,
} from '@/services/studio/zones';
import { areaInAcres, formatArea, percent } from '@/lib/format';
import { uniqueId, cn } from '@/lib/utils';

const VERDICT_VARIANT = {
  recommended: 'success',
  conditional: 'info',
  rejected: 'danger',
} as const;

export default function CropStudioPage(): JSX.Element {
  const { field, intelligence, running, error, run } = useFieldIntelligence();
  const { evaluation } = intelligence;

  const scenarios = usePlanStore((s) => s.scenarios);
  const activeId = usePlanStore((s) => s.activeId);
  const createScenario = usePlanStore((s) => s.createScenario);
  const setActive = usePlanStore((s) => s.setActive);
  const renameScenario = usePlanStore((s) => s.renameScenario);
  const deleteScenario = usePlanStore((s) => s.deleteScenario);
  const updateZones = usePlanStore((s) => s.updateZones);
  const undo = usePlanStore((s) => s.undo);

  const fieldScenarios = useMemo(
    () => scenarios.filter((scenario) => scenario.fieldId === field?.id),
    [scenarios, field?.id],
  );
  const active = useMemo(
    () => fieldScenarios.find((scenario) => scenario.id === activeId) ?? fieldScenarios[0] ?? null,
    [fieldScenarios, activeId],
  );

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [addCropId, setAddCropId] = useState<string>('');

  const allocatable = useMemo(() => {
    if (!evaluation) return [];
    return [...evaluation.recommended, ...evaluation.conditional].sort((a, b) => b.score - a.score);
  }, [evaluation]);

  const recommendedSpecs = useMemo<PlanZoneSpec[]>(() => {
    if (!intelligence.planning?.zones.length) return [];
    return intelligence.planning.zones.map((zone) => ({
      id: uniqueId('zone'),
      cropId: zone.cropId,
      share: zone.share,
    }));
  }, [intelligence.planning]);

  useEffect(() => {
    if (!field || fieldScenarios.length || !recommendedSpecs.length) return;
    createScenario(field.id, 'Scenario A', recommendedSpecs);
  }, [field, fieldScenarios.length, recommendedSpecs, createScenario]);

  const zones = useMemo(() => {
    if (!field || !active) return [];
    return buildStudioZones({ field, specs: active.zones, evaluations: evaluation?.evaluations ?? [] });
  }, [field, active, evaluation]);

  const contained = useMemo(() => (field ? zonesContainedByField(zones, field) : true), [zones, field]);

  const applyZones = useCallback((next: PlanZoneSpec[]) => updateZones(next), [updateZones]);

  const changeZoneCrop = useCallback(
    (zoneId: string, cropId: string) => {
      if (!active) return;
      applyZones(active.zones.map((zone) => (zone.id === zoneId ? { ...zone, cropId } : zone)));
    },
    [active, applyZones],
  );

  const setZoneShare = useCallback(
    (zoneId: string, share: number) => {
      if (!active) return;
      applyZones(active.zones.map((zone) => (zone.id === zoneId ? { ...zone, share } : zone)));
    },
    [active, applyZones],
  );

  const addZone = useCallback(
    (cropId: string) => {
      if (!active || !cropId) return;
      const smallest = active.zones.length ? Math.min(...active.zones.map((z) => z.share)) : 1;
      const next = [...active.zones, { id: uniqueId('zone'), cropId, share: Math.max(0.05, smallest * 0.6) }];
      applyZones(normaliseShares(next));
    },
    [active, applyZones],
  );

  const removeZone = useCallback(
    (zoneId: string) => {
      if (!active || active.zones.length <= 1) return;
      applyZones(active.zones.filter((zone) => zone.id !== zoneId));
      setSelectedZoneId(null);
    },
    [active, applyZones],
  );

  const splitZone = useCallback(
    (zoneId: string) => {
      if (!active) return;
      const zone = active.zones.find((z) => z.id === zoneId);
      if (!zone) return;
      const half = zone.share / 2;
      const next = active.zones.flatMap((z) =>
        z.id === zoneId
          ? [
              { ...z, share: half },
              { id: uniqueId('zone'), cropId: z.cropId, share: half },
            ]
          : [z],
      );
      applyZones(next);
    },
    [active, applyZones],
  );

  const mergeSameCrop = useCallback(() => {
    if (!active) return;
    const merged: PlanZoneSpec[] = [];
    for (const zone of active.zones) {
      const existing = merged.find((z) => z.cropId === zone.cropId);
      if (existing) existing.share += zone.share;
      else merged.push({ ...zone });
    }
    if (merged.length !== active.zones.length) applyZones(merged);
  }, [active, applyZones]);

  const resetToRecommended = useCallback(() => {
    if (!recommendedSpecs.length) return;
    applyZones(recommendedSpecs.map((spec) => ({ ...spec, id: uniqueId('zone') })));
  }, [recommendedSpecs, applyZones]);

  const addScenario = useCallback(() => {
    if (!field || !active) return;
    const label = `Scenario ${String.fromCharCode(65 + fieldScenarios.length)}`;
    createScenario(field.id, label, active.zones.map((zone) => ({ ...zone, id: uniqueId('zone') })));
  }, [field, active, fieldScenarios.length, createScenario]);

  const donutData = zones.map((zone) => ({ name: zone.cropName, value: zone.share, color: zone.color }));
  const totalArea = zones.reduce((acc, zone) => acc + zone.areaM2, 0);
  const waterDemand = weightedWaterMm(zones);
  const suitability = meanSuitability(zones);

  if (!field) {
    return (
      <PageScaffold
        title="Crop Planning Studio"
        description="Turn a field's rules-engine crop ranking into a spatial allocation plan inside its real boundary."
      >
        <NoFieldSelected />
      </PageScaffold>
    );
  }

  return (
    <PageScaffold
      title="Crop Planning Studio"
      description="Allocate rule-approved crops to real zones inside the drawn boundary, edit the plan, compare scenarios and export it."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={run} disabled={running}>
            Re-evaluate
          </Button>
          <Button asChild variant="lime" size="sm">
            <Link to="/reports">
              Export plan
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-4 sm:p-6">
        {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}

        {!evaluation ? (
          <UnavailableState
            title="No crop evaluation for this field yet"
            message="The studio allocates crops from the rules-engine ranking. Run the field analysis to score the crop profiles, then return here."
          />
        ) : null}

        {evaluation && !intelligence.planning ? (
          <InlineNotice tone="warning">
            The rules engine returned a ranking but no zone allocation, so the studio cannot seed a plan. Re-run the
            analysis.
          </InlineNotice>
        ) : null}

        {evaluation && intelligence.planning ? (
          <>
            {CROP_DATASET_META.isDemonstration ? (
              <DemoNotice>
                Zone geometry is computed in the browser from your drawn boundary using Turf.js. Zone areas and shares are
                real; the crop reference values come from the bundled {CROP_DATASET_META.size}-profile demonstration
                dataset.
              </DemoNotice>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {fieldScenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => setActive(scenario.id)}
                  className={cn(
                    'group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors',
                    scenario.id === active?.id
                      ? 'border-lime bg-lime text-forest-950'
                      : 'border-border bg-card text-foreground hover:border-lime/50',
                  )}
                >
                  {scenario.name}
                  <span className="font-mono text-2xs opacity-70">{scenario.zones.length}</span>
                </button>
              ))}
              <Button variant="outline" size="sm" className="rounded-full" onClick={addScenario}>
                <Plus className="size-3.5" />
                Scenario
              </Button>
              {active && fieldScenarios.length > 1 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => deleteScenario(active.id)}
                >
                  <Trash2 className="size-3.5" />
                  Delete {active.name}
                </Button>
              ) : null}
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <MetricTile
                label="Planned area"
                value={formatArea(totalArea)}
                sub={`${areaInAcres(totalArea).toFixed(2)} acres`}
              />
              <MetricTile label="Crop zones" value={String(zones.length)} sub={active?.name ?? 'Scenario'} />
              <MetricTile
                label="Weighted water demand"
                value={`${Math.round(waterDemand)} mm`}
                sub="Area-weighted mean of zone demand"
              />
              <MetricTile
                label="Mean suitability"
                value={suitability === null ? '—' : `${Math.round(suitability * 100)}`}
                sub={suitability === null ? 'No scored crops' : 'Share-weighted score'}
                tone="positive"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <SectionCard
                title="Spatial crop allocation"
                description="Proposed planning zones inside the drawn boundary. Not measured soil or vegetation differences."
                bodyClassName="p-0"
                actions={<Badge variant="outline">{zones.length} zones</Badge>}
              >
                <div className="relative h-[420px] overflow-hidden border-y border-border/60 lg:h-[560px]">
                  <EarthMap
                    fieldCoords={field.boundary.coords}
                    zones={zones}
                    markers={zones.map((zone) => ({ coord: zone.centroid, color: zone.color, radius: 5 }))}
                    compact
                    className="size-full"
                  />

                  {/* Floating legend — the map is the centre of the studio, so its
                      key lives on the map rather than below it. */}
                  <div className="chrome pointer-events-auto absolute left-3 top-3 z-20 max-w-[220px] p-3">
                    <p className="label-caps text-cream/55">Proposed allocation</p>
                    <ul className="mt-2 space-y-1.5">
                      {zones.map((zone) => (
                        <li key={zone.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedZoneId(zone.id)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-2xs transition-colors',
                              zone.id === selectedZoneId ? 'bg-white/10' : 'hover:bg-white/[0.07]',
                            )}
                          >
                            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: zone.color }} aria-hidden />
                            <span className="truncate font-medium text-cream">{zone.cropName}</span>
                            <span className="ml-auto shrink-0 font-mono tabular-nums text-cream/60">
                              {percent(zone.share, 0)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 border-t border-white/[0.09] pt-2 text-[0.625rem] leading-relaxed text-cream/45">
                      Planning allocation inside the drawn boundary — not measured soil or vegetation variation.
                    </p>
                  </div>

                  {/* Floating field summary pill. */}
                  <div className="chrome pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-4 px-3 py-2">
                    <span className="flex flex-col">
                      <span className="label-caps text-cream/50">Boundary</span>
                      <span className="font-mono text-xs tabular-nums text-cream">
                        {formatArea(field.boundary.areaM2)}
                      </span>
                    </span>
                    <span className="h-6 w-px bg-white/12" aria-hidden />
                    <span className="flex flex-col">
                      <span className="label-caps text-cream/50">Planned</span>
                      <span className="font-mono text-xs tabular-nums text-cream">{formatArea(totalArea)}</span>
                    </span>
                    <span className="h-6 w-px bg-white/12" aria-hidden />
                    <span className="flex flex-col">
                      <span className="label-caps text-cream/50">Zones</span>
                      <span className="font-mono text-xs tabular-nums text-cream">{zones.length}</span>
                    </span>
                  </div>
                </div>
                {!contained ? (
                  <p className="border-t border-border/60 px-4 py-2.5 text-2xs text-amber-500">
                    Some zone centroids fall outside the boundary — reduce the number of zones or redraw a convex field.
                  </p>
                ) : null}
              </SectionCard>

              <div className="space-y-4">
                <SectionCard
                  title="Allocate crops"
                  description="Only crops the rules engine approved can be allocated."
                  actions={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={resetToRecommended}
                      title="Rebuild the plan from the rules-engine allocation"
                    >
                      <RotateCcw className="size-3.5" />
                      Reset
                    </Button>
                  }
                >
                  <div className="flex items-center gap-2">
                    <Select value={addCropId} onValueChange={setAddCropId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder={`Add from ${allocatable.length} approved crops`} />
                      </SelectTrigger>
                      <SelectContent>
                        {allocatable.map((entry) => (
                          <SelectItem key={entry.crop.id} value={entry.crop.id}>
                            {entry.crop.name} · {Math.round(entry.score * 100)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="lime"
                      size="sm"
                      onClick={() => addCropId && addZone(addCropId)}
                      disabled={!addCropId}
                    >
                      <Plus className="size-3.5" />
                      Add
                    </Button>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={undo}>
                      <Undo2 className="size-3.5" />
                      Undo
                    </Button>
                    <Button variant="outline" size="sm" onClick={mergeSameCrop} disabled={zones.length < 2}>
                      <GitBranch className="size-3.5" />
                      Merge same crop
                    </Button>
                  </div>
                  <p className="mt-3 text-2xs leading-relaxed text-muted-foreground">
                    {allocatable.length} of {evaluation.datasetSize} profiles passed the rules engine and can be allocated.
                    Rejected crops cannot be placed — see the comparison page for their constraint reasons.
                  </p>
                </SectionCard>

                <SectionCard title="Plan composition" description="Share of the usable field area.">
                  <AllocationBar
                    segments={zones.map((zone) => ({
                      id: zone.id,
                      label: zone.cropName,
                      color: zone.color,
                      share: zone.share,
                      detail: formatArea(zone.areaM2),
                    }))}
                  />
                  <Separator className="my-3.5" />
                  <AllocationDonut data={donutData} height={150} />
                  <ul className="mt-3 space-y-2.5">
                    {zones.map((zone) => (
                      <li key={zone.id} className="space-y-1.5">
                        <div className="flex items-center gap-2 text-2xs">
                          <span className="size-2.5 shrink-0 rounded-sm" style={{ background: zone.color }} aria-hidden />
                          <span className="truncate font-medium">{zone.cropName}</span>
                          <Badge variant={VERDICT_VARIANT[zone.verdict]} className="ml-auto shrink-0">
                            {zone.score === null ? '—' : Math.round(zone.score * 100)}
                          </Badge>
                          <span className="w-16 shrink-0 text-right font-mono tabular-nums text-muted-foreground">
                            {formatArea(zone.areaM2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={100}
                          value={Math.round(zone.share * 100)}
                          onChange={(event) => setZoneShare(zone.id, Number(event.target.value) / 100)}
                          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-lime-600"
                          aria-label={`${zone.cropName} share of field`}
                        />
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              </div>
            </div>

            <SectionCard
              title="Zone detail"
              description="Select a zone to inspect its crop, area, evidence and constraints."
              bodyClassName="p-0"
            >
              <ul className="divide-y divide-border/50">
                {zones.map((zone) => {
                  const isSelected = zone.id === selectedZoneId;
                  return (
                    <li key={zone.id} className={cn('px-4 py-3 transition-colors', isSelected && 'bg-lime/[0.05]')}>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedZoneId(isSelected ? null : zone.id)}
                          className="flex min-w-0 items-center gap-2 text-left"
                        >
                          <span className="size-3 shrink-0 rounded-sm" style={{ background: zone.color }} aria-hidden />
                          <span className="text-xs font-semibold">{zone.cropName}</span>
                          {zone.scientificName ? (
                            <span className="truncate text-2xs italic text-muted-foreground">
                              {zone.scientificName}
                            </span>
                          ) : null}
                        </button>
                        <Badge variant={VERDICT_VARIANT[zone.verdict]}>{zone.verdict}</Badge>
                        <span className="font-mono text-2xs text-muted-foreground">{percent(zone.share, 1)}</span>
                        <span className="font-mono text-2xs text-muted-foreground">{formatArea(zone.areaM2)}</span>
                        <span className="font-mono text-2xs text-muted-foreground">{Math.round(zone.waterNeedMm)} mm</span>

                        <div className="ml-auto flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Split zone in two"
                            onClick={() => splitZone(zone.id)}
                          >
                            <Scissors className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-red-400"
                            title="Remove zone"
                            onClick={() => removeZone(zone.id)}
                            disabled={zones.length <= 1}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>

                      {isSelected ? (
                        <div className="mt-3 space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-2xs font-medium text-muted-foreground">Change crop</span>
                            <Select value={zone.cropId} onValueChange={(value) => changeZoneCrop(zone.id, value)}>
                              <SelectTrigger className="h-8 w-[210px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {allocatable.map((entry) => (
                                  <SelectItem key={entry.crop.id} value={entry.crop.id}>
                                    {entry.crop.name} · {Math.round(entry.score * 100)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="font-mono text-2xs text-muted-foreground">
                              {(zone.areaM2 / 10000).toFixed(2)} ha · {areaInAcres(zone.areaM2).toFixed(2)} ac
                            </span>
                          </div>
                          <p className="text-2xs leading-relaxed text-muted-foreground">{zone.rationale}</p>
                          <p className="text-2xs leading-relaxed text-amber-500/90">
                            Zone geometry is a proposed planning allocation derived from the field boundary — it does not
                            represent measured within-field soil or vegetation variation.
                          </p>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </SectionCard>

            <SectionCard
              title="Scenario comparison"
              description="Every scenario is a user-created hypothetical. Figures below are area-weighted sums of the rules-engine values, not production forecasts."
            >
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/70 text-left">
                      <th className="py-2 pr-3 font-semibold">Scenario</th>
                      <th className="px-3 py-2 font-semibold">Crops</th>
                      <th className="px-3 py-2 text-right font-semibold">Zones</th>
                      <th className="px-3 py-2 text-right font-semibold">Water demand</th>
                      <th className="px-3 py-2 text-right font-semibold">Mean score</th>
                      <th className="py-2 pl-3 text-right font-semibold"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldScenarios.map((scenario) => {
                      const scenarioZones = buildStudioZones({
                        field,
                        specs: scenario.zones,
                        evaluations: evaluation.evaluations,
                      });
                      const scenarioWater = weightedWaterMm(scenarioZones);
                      const scenarioScore = meanSuitability(scenarioZones);
                      const isActive = scenario.id === active?.id;
                      return (
                        <tr key={scenario.id} className={cn('border-b border-border/40', isActive && 'bg-lime/[0.05]')}>
                          <td className="py-2.5 pr-3">
                            <input
                              value={scenario.name}
                              onChange={(event) => renameScenario(scenario.id, event.target.value)}
                              className="w-full min-w-[90px] rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium hover:border-border focus:border-lime focus:outline-none"
                              aria-label="Scenario name"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <AllocationBar
                              showLegend={false}
                              segments={scenarioZones.map((zone) => ({
                                id: zone.id,
                                label: zone.cropName,
                                color: zone.color,
                                share: zone.share,
                              }))}
                            />
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {scenarioZones.map((zone) => (
                                <span
                                  key={zone.id}
                                  className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-2xs"
                                >
                                  <span className="size-2 rounded-sm" style={{ background: zone.color }} aria-hidden />
                                  {zone.cropName}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">{scenarioZones.length}</td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">{Math.round(scenarioWater)} mm</td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                            {scenarioScore === null ? '—' : Math.round(scenarioScore * 100)}
                          </td>
                          <td className="py-2.5 pl-3 text-right">
                            {isActive ? (
                              <Badge variant="lime">Active</Badge>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => setActive(scenario.id)}>
                                Open
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 flex items-start gap-2 text-2xs leading-relaxed text-muted-foreground">
                <Layers className="mt-0.5 size-3.5 shrink-0" />
                Water demand is the area-weighted mean of each crop's documented requirement range midpoint. It is an
                irrigation planning indicator, not a measured field consumption figure.
              </p>
            </SectionCard>

            <SectionCard
              title="Export"
              description="The PDF uses the active scenario's zones, the field boundary and the retrieved analysis."
            >
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild variant="lime" size="sm">
                  <Link to="/reports">
                    <Save className="size-3.5" />
                    Open report builder
                  </Link>
                </Button>
                <span className="text-2xs text-muted-foreground">
                  {active ? `${active.name} · ${zones.length} zones · ${formatArea(totalArea)}` : 'No active scenario'}
                </span>
              </div>
            </SectionCard>
          </>
        ) : null}

        {!evaluation && !running ? (
          <SectionCard title="How the studio works">
            <ol className="space-y-2 text-2xs leading-relaxed text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-mono text-lime-600">01</span>
                Draw and save a field boundary on the Earth Explorer.
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-lime-600">02</span>
                Run the field analysis so the rules engine scores all {CROP_DATASET_META.size} crop profiles.
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-lime-600">03</span>
                Return here — the studio partitions the boundary into crop zones and lets you edit, compare and export.
              </li>
            </ol>
          </SectionCard>
        ) : null}
      </div>
    </PageScaffold>
  );
}
