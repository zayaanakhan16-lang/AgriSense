import { useMemo, useState } from 'react';
import { CalendarDays, Droplets, Leaf, Lightbulb, Ruler, Sprout, Wheat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { EarthMap } from '@/components/map/EarthMap';
import { useFieldsStore } from '@/store/fieldsStore';
import {
  EXPERT_TIPS,
  buildCalendarRows,
  buildCropDetail,
  buildIntercropPairs,
  buildRotationGroups,
} from '@/services/regionAnalytics';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CropPlanPage(): JSX.Element {
  const fields = useFieldsStore((s) => s.fields);
  const selectedFieldId = useFieldsStore((s) => s.selectedFieldId);
  const field = fields.find((entry) => entry.id === selectedFieldId) ?? fields[0] ?? null;

  const [activePair, setActivePair] = useState<string | null>(null);

  const detail = useMemo(() => buildCropDetail(), []);
  const pairs = useMemo(() => buildIntercropPairs(field?.boundary.centroid ?? { lng: 0, lat: 0 }, field?.boundary.areaM2 ?? 1), [field]);
  const rotation = useMemo(() => buildRotationGroups(), []);
  const calendar = useMemo(() => buildCalendarRows(), []);

  if (!field) {
    return (
      <div className="flex size-full items-center justify-center bg-forest-950">
        <div className="chrome max-w-sm p-6 text-center">
          <Sprout className="mx-auto size-6 text-lime" aria-hidden />
          <h1 className="mt-3 type-section text-cream">No region selected</h1>
          <p className="mt-1 text-2xs leading-relaxed text-cream/60">
            Select a region to open its crop plan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative size-full overflow-hidden bg-forest-950">
      <div className="pointer-events-none absolute inset-0 opacity-30 blur-[2px]">
        <EarthMap fieldCoords={field.boundary.coords} showCursorReadout={false} compact className="size-full" />
      </div>

      <div className="relative z-10 h-full overflow-y-auto px-3 py-5 sm:px-5">
        <div className="mx-auto w-full max-w-[1080px] space-y-4">
          {/* ---------------------------------------------------------- header */}
          <div className="chrome p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-base font-semibold text-cream">Crop Planning</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge variant="lime">{field.name}</Badge>
                  <Badge variant="muted">{field.crop ?? 'Wheat'}</Badge>
                  <Badge variant="warning">Sample recommendations</Badge>
                </div>
              </div>
              <p className="max-w-md text-2xs leading-relaxed text-cream/50">
                Intercropping, rotation and calendar suggestions below are illustrative sample guidance for the selected
                region — confirm them against local agronomy before planting.
              </p>
            </div>
          </div>

          {/* ----------------------------------------------------- crop details */}
          <section className="chrome p-4">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold text-cream">
              <Wheat className="size-3.5 text-lime" aria-hidden />
              {detail.name} — crop details
            </h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              <Detail label="Area" value={detail.area} icon={Sprout} />
              <Detail label="Spacing" value={detail.spacing} icon={Ruler} />
              <Detail label="Water" value={detail.water} icon={Droplets} />
              <Detail label="Yield" value={detail.yield} icon={Wheat} />
              <Detail label="Season" value={detail.season} icon={CalendarDays} />
            </div>
          </section>

          {/* --------------------------------------------------- intercropping */}
          <section className="chrome p-4">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold text-cream">
              <Leaf className="size-3.5 text-lime" aria-hidden />
              Intercropping Pairs
            </h2>
            <div className="grid gap-2.5 md:grid-cols-2">
              {pairs.map((pair) => (
                <button
                  key={pair.id}
                  type="button"
                  onClick={() => setActivePair(activePair === pair.id ? null : pair.id)}
                  className={cn(
                    'rounded-lg border p-3.5 text-left transition-colors',
                    activePair === pair.id ? 'border-lime/35 bg-lime/[0.08]' : 'border-white/10 hover:bg-white/[0.05]',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-cream">{pair.title}</span>
                    <span className="ml-auto flex items-center gap-1">
                      {pair.crops.map((crop) => (
                        <span key={crop} className="rounded-sm bg-white/[0.08] px-1.5 py-px text-[0.5625rem] text-cream/70">
                          {crop}
                        </span>
                      ))}
                    </span>
                  </div>
                  <p className="mt-1.5 text-2xs leading-relaxed text-cream/60">{pair.explanation}</p>
                  <p className="mt-2 flex items-start gap-1.5 text-2xs text-cream/50">
                    <Ruler className="mt-0.5 size-3 shrink-0 text-lime/70" aria-hidden />
                    {pair.spacing}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* ------------------------------------------------ crop rotation plan */}
          <section className="chrome p-4">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold text-cream">
              <Sprout className="size-3.5 text-lime" aria-hidden />
              Crop Rotation Plan
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {rotation.map((group) => (
                <div key={group.season} className="rounded-lg border border-white/10 bg-black/20 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-cream">{group.season}</span>
                    <span className="font-mono text-2xs text-cream/50">{group.range}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {group.crops.map((crop) => (
                      <span
                        key={crop.name}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-0.5 text-2xs text-cream/80"
                      >
                        <span className="size-2 rounded-full" style={{ background: crop.color }} aria-hidden />
                        {crop.name}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-2xs leading-relaxed text-cream/50">{group.note}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ----------------------------------------------------- crop calendar */}
          <section className="chrome p-4">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold text-cream">
              <CalendarDays className="size-3.5 text-lime" aria-hidden />
              Crop Calendar
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-2xs">
                <thead>
                  <tr>
                    <th className="w-[120px] border-b border-white/10 px-2 py-2 text-left font-semibold text-cream/70">
                      Season
                    </th>
                    {MONTHS.map((month) => (
                      <th
                        key={month}
                        className="border-b border-l border-white/[0.06] px-1 py-2 text-center font-medium text-cream/50"
                      >
                        {month}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calendar.map((row) => (
                    <tr key={row.season}>
                      <td className="border-b border-white/[0.06] px-2 py-2">
                        <span className="flex items-center gap-2">
                          <span className="size-2 rounded-full" style={{ background: row.color }} aria-hidden />
                          <span className="font-medium text-cream/85">{row.season}</span>
                        </span>
                        <span className="mt-0.5 block text-[0.625rem] text-cream/45">{row.crop}</span>
                      </td>
                      {MONTHS.map((month, index) => {
                        const active = row.months.includes(index);
                        return (
                          <td
                            key={month}
                            className="border-b border-l border-white/[0.06] px-0.5 py-2 text-center"
                          >
                            {active ? (
                              <span
                                className="mx-auto block h-3.5 w-full max-w-[34px] rounded-sm"
                                style={{ background: row.color, opacity: 0.85 }}
                                aria-hidden
                              />
                            ) : (
                              <span className="mx-auto block h-3.5 w-full max-w-[34px] rounded-sm bg-white/[0.04]" aria-hidden />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ------------------------------------------------------- expert tips */}
          <section className="chrome p-4">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold text-cream">
              <Lightbulb className="size-3.5 text-lime" aria-hidden />
              Expert Tips
            </h2>
            <ul className="space-y-2">
              {EXPERT_TIPS.map((tip, index) => (
                <li key={index} className="flex items-start gap-2.5">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-lime" aria-hidden />
                  <span className="text-2xs leading-relaxed text-cream/70">{tip}</span>
                </li>
              ))}
            </ul>
            <Separator className="my-3.5 bg-white/[0.08]" />
            <p className="text-[0.625rem] leading-relaxed text-cream/40">
              Illustrative sample guidance generated for this demonstration region. Not verified agronomic advice.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Sprout }): JSX.Element {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-3xs uppercase tracking-[0.1em] text-cream/45">
        <Icon className="size-3 text-lime/70" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-xs font-semibold text-cream/90">{value}</p>
    </div>
  );
}
