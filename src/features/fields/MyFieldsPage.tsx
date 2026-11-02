import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Compass, Layers3, MapPin, Plus, Sprout, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/StateBlocks';
import { PageScaffold, SectionCard } from '@/components/layout/PageScaffold';
import { formatAcres, formatArea, formatCoord, formatDate } from '@/lib/format';
import { useFieldsStore } from '@/store/fieldsStore';
import { useAnalysisStore } from '@/store/analysisStore';
import { useMapStore } from '@/store/mapStore';
import { cn } from '@/lib/utils';

const STATUS_VARIANT = {
  draft: 'muted',
  analyzing: 'warning',
  ready: 'success',
  error: 'danger',
} as const;

export default function MyFieldsPage(): JSX.Element {
  const navigate = useNavigate();
  const fields = useFieldsStore((s) => s.fields);
  const selectField = useFieldsStore((s) => s.selectField);
  const deleteField = useFieldsStore((s) => s.deleteField);
  const selectedFieldId = useFieldsStore((s) => s.selectedFieldId);
  const analysisFieldId = useAnalysisStore((s) => s.fieldId);
  const analysisCompleted = useAnalysisStore((s) => s.completed);
  const flyTo = useMapStore((s) => s.flyTo);

  return (
    <PageScaffold
      title="My Fields"
      description="Every boundary you have drawn, with its computed area and analysis state."
      actions={
        <Button asChild variant="lime" size="sm">
          <Link to="/">
            <Plus className="size-3.5" />
            Draw a new field
          </Link>
        </Button>
      }
    >
      <div className="p-4 sm:p-6">
        {fields.length === 0 ? (
          <EmptyState
            icon={Layers3}
            title="No fields saved yet"
            description="Open the Earth Explorer, select Draw Field, and trace your first boundary. Areas are computed geodesically the moment you close the polygon."
            action={
              <Button asChild variant="lime">
                <Link to="/">
                  <Compass className="size-4" />
                  Open Earth Explorer
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {fields.map((field) => {
              const analysed = analysisFieldId === field.id && analysisCompleted;
              const isActive = selectedFieldId === field.id;
              return (
                <SectionCard
                  key={field.id}
                  className={cn('transition-colors', isActive && 'border-lime/45')}
                  bodyClassName="p-0"
                >
                  <div className="flex items-start justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold">{field.name}</h3>
                        {isActive ? <span className="size-1.5 shrink-0 rounded-full bg-lime" aria-hidden /> : null}
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 truncate text-2xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" />
                        {field.locationLabel}
                      </p>
                    </div>
                    <Badge variant={analysed ? 'success' : STATUS_VARIANT[field.status]}>
                      {analysed ? 'analysed' : field.status}
                    </Badge>
                  </div>

                  <dl className="grid grid-cols-2 gap-px border-y border-border/60 bg-border/50">
                    <div className="bg-card px-4 py-2.5">
                      <dt className="label-caps">Area</dt>
                      <dd className="mt-0.5 font-mono text-xs font-semibold tabular-nums">{formatArea(field.boundary.areaM2)}</dd>
                      <dd className="text-2xs text-muted-foreground">{formatAcres(field.boundary.areaM2)}</dd>
                    </div>
                    <div className="bg-card px-4 py-2.5">
                      <dt className="label-caps">Vertices</dt>
                      <dd className="mt-0.5 font-mono text-xs font-semibold tabular-nums">{field.boundary.vertexCount}</dd>
                      <dd className="text-2xs text-muted-foreground">{formatDate(field.createdAt)}</dd>
                    </div>
                  </dl>

                  <div className="px-4 py-2.5">
                    <p className="font-mono text-2xs text-muted-foreground">
                      {formatCoord(field.boundary.centroid, 4)}
                    </p>
                    {field.soilTexture ? (
                      <p className="mt-1 text-2xs text-muted-foreground">Soil: {field.soilTexture}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-3">
                    <Button
                      variant="lime"
                      size="sm"
                      onClick={() => {
                        selectField(field.id);
                        navigate('/intelligence');
                      }}
                    >
                      <Sprout className="size-3.5" />
                      Intelligence
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        selectField(field.id);
                        flyTo({ coord: field.boundary.centroid, zoom: 16, bbox: field.boundary.bbox });
                        navigate('/');
                      }}
                    >
                      <Compass className="size-3.5" />
                      View on map
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="ml-auto text-muted-foreground hover:text-red-300"
                      onClick={() => deleteField(field.id)}
                      aria-label={`Delete ${field.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </SectionCard>
              );
            })}
          </div>
        )}

        {fields.length > 0 ? (
          <div className="mt-5 rounded-xl border border-border/60 bg-muted/15 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold">Continue to planning</h3>
                <p className="mt-0.5 text-2xs text-muted-foreground">
                  Crop planning, the seasonal calendar and the decision center all read from the selected field.
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/crops">
                  Open crop planning
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </PageScaffold>
  );
}
