import { Link } from 'react-router-dom';
import { ChevronDown, Sprout } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatArea } from '@/lib/format';
import { useFieldsStore } from '@/store/fieldsStore';
import { useAnalysisStore } from '@/store/analysisStore';

const STATUS_VARIANT = {
  draft: 'muted',
  analyzing: 'warning',
  ready: 'success',
  error: 'danger',
} as const;

/**
 * Persistent field context. The selected field is shared across every intelligence
 * section, so navigating between them never loses the field being studied.
 */
export function FieldContextBar(): JSX.Element {
  const fields = useFieldsStore((s) => s.fields);
  const selectedFieldId = useFieldsStore((s) => s.selectedFieldId);
  const selectField = useFieldsStore((s) => s.selectField);
  const analysisFieldId = useAnalysisStore((s) => s.fieldId);
  const analysisRunning = useAnalysisStore((s) => s.running);

  const selected = fields.find((field) => field.id === selectedFieldId) ?? null;
  const analysisMatches = analysisFieldId === selectedFieldId && selected !== null;

  if (!fields.length) {
    return (
      <Button asChild variant="lime" size="sm">
        <Link to="/">
          <Sprout className="size-3.5" />
          Draw your first field
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedFieldId ?? ''}
        onValueChange={(value) => selectField(value)}
      >
        <SelectTrigger
          className="h-8 w-[190px] border-white/15 bg-white/[0.07] text-xs text-cream hover:bg-white/[0.11] sm:w-[230px]"
          aria-label="Select active field"
        >
          <SelectValue placeholder="Select a field" />
        </SelectTrigger>
        <SelectContent>
          {fields.map((field) => (
            <SelectItem key={field.id} value={field.id}>
              <span className="flex flex-col">
                <span className="text-xs font-medium">{field.name}</span>
                <span className="text-2xs text-muted-foreground">
                  {formatArea(field.boundary.areaM2)} · {field.locationLabel}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected ? (
        <Badge variant={STATUS_VARIANT[selected.status]} className="hidden sm:inline-flex">
          {analysisRunning && analysisMatches ? 'Analysing' : selected.status}
        </Badge>
      ) : null}

      <Button
        asChild
        variant="shell"
        size="sm"
        className="hidden border border-white/15 md:inline-flex"
      >
        <Link to="/">
          <ChevronDown className="size-3.5 rotate-90" />
          New field
        </Link>
      </Button>
    </div>
  );
}

export function NoFieldSelected({ className }: { className?: string }): JSX.Element {
  return (
    <div className={cn('flex h-full items-center justify-center p-8', className)}>
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-lime/10 text-lime">
          <Sprout className="size-5" />
        </div>
        <h2 className="font-display text-lg font-semibold">No field selected</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Draw a boundary on the Earth globe, or pick a saved field from the header. Every intelligence section reads from
          the same field context, so the boundary, soil profile and climate history stay consistent as you navigate.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button asChild variant="lime">
            <Link to="/">Open Earth Explorer</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/fields">My Fields</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
