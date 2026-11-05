import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, MapPin, Sprout, Trees } from 'lucide-react';
import type { Field, RegionType } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { areaInAcres } from '@/lib/format';
import {
  CROP_OPTIONS,
  DEFAULT_REGION_COLOR,
  DEFAULT_REGION_GROUP,
  REGION_COLORS,
  REGION_GROUP_OPTIONS,
  REGION_TYPES,
} from '@/data/regions';

export interface RegionDraft {
  name: string;
  regionType: RegionType;
  crop: string;
  group: string;
  color: string;
}

export interface RegionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Detected geodesic area of the drawn region. */
  areaM2: number;
  /** Detected location label. */
  locationLabel: string;
  /** Pre-fill values when editing an existing region. */
  initial?: Partial<Field>;
  mode?: 'create' | 'edit';
  onSubmit: (draft: RegionDraft) => void;
}

const TYPE_ICON: Record<RegionType, typeof Trees> = {
  rural: Trees,
  urban: Building2,
};

/**
 * New Region / Edit Region dialog.
 *
 * Centred modal over the (blurred) map. Area and location are the values the
 * app actually detected from the drawn boundary — they are shown, not typed.
 */
export function RegionDialog({
  open,
  onOpenChange,
  areaM2,
  locationLabel,
  initial,
  mode = 'create',
  onSubmit,
}: RegionDialogProps): JSX.Element {
  const [name, setName] = useState('');
  const [regionType, setRegionType] = useState<RegionType>('rural');
  const [crop, setCrop] = useState<string>('Wheat');
  const [group, setGroup] = useState<string>(DEFAULT_REGION_GROUP);
  const [color, setColor] = useState<string>(DEFAULT_REGION_COLOR);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setRegionType(initial?.regionType ?? 'rural');
    setCrop(initial?.crop ?? 'Wheat');
    setGroup(initial?.group ?? DEFAULT_REGION_GROUP);
    setColor(initial?.color ?? DEFAULT_REGION_COLOR);
    setError(null);
  }, [open, initial]);

  const acres = useMemo(() => areaInAcres(areaM2), [areaM2]);

  const handleSave = (): void => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the region a name before saving.');
      return;
    }
    onSubmit({ name: trimmed, regionType, crop, group, color });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-white/10 bg-forest-900 p-0 text-cream">
        <DialogHeader className="border-b border-white/10 px-6 py-4">
          <DialogTitle className="font-display text-base font-semibold text-cream">
            {mode === 'edit' ? 'Edit Region' : 'New Region'}
          </DialogTitle>
          <DialogDescription className="text-2xs leading-relaxed text-cream/55">
            {mode === 'edit'
              ? 'Update this region’s details. The boundary geometry is unchanged.'
              : 'Name the boundary you drew and describe how the land is used.'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[64vh] space-y-4 overflow-y-auto px-6 py-5">
          {/* ---------------------------------------------------------- name */}
          <label className="block">
            <span className="label-caps text-cream/55">Region Name</span>
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSave();
              }}
              placeholder="e.g. My Farm"
              autoFocus
              className="mt-1.5 h-9 border-white/15 bg-white/[0.06] text-cream placeholder:text-cream/35 focus-visible:ring-lime"
            />
          </label>

          {/* ---------------------------------------------------------- type */}
          <div>
            <span className="label-caps text-cream/55">Region Type</span>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {REGION_TYPES.map((option) => {
                const Icon = TYPE_ICON[option.id];
                const active = regionType === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setRegionType(option.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                      active
                        ? 'border-lime/50 bg-lime/[0.12]'
                        : 'border-white/12 bg-white/[0.03] hover:border-white/25',
                    )}
                  >
                    <Icon className={cn('mt-0.5 size-4 shrink-0', active ? 'text-lime' : 'text-cream/50')} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-cream/90">{option.label}</span>
                      <span className="block text-2xs text-cream/50">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* -------------------------------------------------- crop + group */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label-caps text-cream/55">Crop / Land Use</span>
              <Select value={crop} onValueChange={setCrop}>
                <SelectTrigger className="mt-1.5 h-9 border-white/15 bg-white/[0.06] text-cream focus:ring-lime">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-forest-900 text-cream">
                  {CROP_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className="focus:bg-white/10 focus:text-cream">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="block">
              <span className="label-caps text-cream/55">Group</span>
              <Select value={group} onValueChange={setGroup}>
                <SelectTrigger className="mt-1.5 h-9 border-white/15 bg-white/[0.06] text-cream focus:ring-lime">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-forest-900 text-cream">
                  {REGION_GROUP_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className="focus:bg-white/10 focus:text-cream">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          {/* ------------------------------------------------ detected facts */}
          <div className="grid gap-2.5 rounded-lg border border-white/10 bg-black/20 p-3 sm:grid-cols-2">
            <div>
              <span className="label-caps text-cream/45">Area (acres)</span>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-lg font-semibold tabular-nums text-cream">
                  {acres > 0 ? acres.toFixed(1) : '—'}
                </span>
                <span className="text-2xs text-cream/50">acres</span>
              </p>
              <p className="text-[0.625rem] text-cream/40">Computed geodesically from the boundary.</p>
            </div>
            <div>
              <span className="label-caps text-cream/45">Location</span>
              <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-cream/80">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-lime" aria-hidden />
                <span className="min-w-0 break-words">{locationLabel || '—'}</span>
              </p>
            </div>
          </div>

          {/* --------------------------------------------------------- colour */}
          <div>
            <span className="label-caps text-cream/55">Region Colour</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {REGION_COLORS.map((option) => {
                const active = color === option.hex;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setColor(option.hex)}
                    aria-label={option.label}
                    aria-pressed={active}
                    title={option.label}
                    className={cn(
                      'flex size-7 items-center justify-center rounded-full border transition-transform',
                      active ? 'scale-110 border-cream' : 'border-white/20 hover:scale-105',
                    )}
                    style={{ background: option.hex }}
                  >
                    {active ? <Check className="size-3.5 text-forest-950" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          {error ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2 text-2xs text-amber-200">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="border-t border-white/10 px-6 py-4">
          <Button
            variant="ghost"
            className="text-cream/70 hover:bg-white/10 hover:text-cream"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button variant="lime" onClick={handleSave}>
            <Sprout className="size-4" />
            {mode === 'edit' ? 'Save Changes' : 'Save Region'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
