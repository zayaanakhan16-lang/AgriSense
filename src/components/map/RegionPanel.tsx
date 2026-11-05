import { useState } from 'react';
import type { Field } from '@/types';
import { RegionList } from '@/components/map/RegionList';
import { RegionDialog } from '@/components/map/RegionDialog';
import { useFieldsStore } from '@/store/fieldsStore';
import { useMapStore } from '@/store/mapStore';

/**
 * Floating Region List panel shared by the map and analytics views.
 *
 * Owns the edit dialog and the delete/zoom actions so both workspaces present
 * the exact same region panel and behaviour.
 */
export function RegionPanel({
  onAddRegion,
  className,
}: {
  onAddRegion?: () => void;
  className?: string;
}): JSX.Element {
  const fields = useFieldsStore((s) => s.fields);
  const selectedFieldId = useFieldsStore((s) => s.selectedFieldId);
  const selectField = useFieldsStore((s) => s.selectField);
  const updateField = useFieldsStore((s) => s.updateField);
  const deleteField = useFieldsStore((s) => s.deleteField);
  const flyTo = useMapStore((s) => s.flyTo);

  const [editing, setEditing] = useState<Field | null>(null);

  return (
    <>
      <div className={className}>
        <RegionList
          fields={fields}
          selectedFieldId={selectedFieldId}
          onSelect={selectField}
          onZoom={(field) => flyTo({ coord: field.boundary.centroid, zoom: 16, bbox: field.boundary.bbox })}
          onEdit={(field) => setEditing(field)}
          onDelete={(field) => {
            if (window.confirm(`Delete “${field.name}”? This cannot be undone.`)) deleteField(field.id);
          }}
          onAddRegion={onAddRegion}
        />
      </div>

      <RegionDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        mode="edit"
        areaM2={editing?.boundary.areaM2 ?? 0}
        locationLabel={editing?.locationLabel ?? ''}
        initial={editing ?? undefined}
        onSubmit={(draft) => {
          if (editing) {
            updateField(editing.id, {
              name: draft.name,
              crop: draft.crop,
              regionType: draft.regionType,
              group: draft.group,
              color: draft.color,
            });
          }
          setEditing(null);
        }}
      />
    </>
  );
}
