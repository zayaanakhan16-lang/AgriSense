import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Field, LngLat, RegionType } from '@/types';
import { bboxOf, centroidOf, closeRing, perimeterM, polygonAreaM2 } from '@/lib/geo';
import { uniqueId } from '@/lib/utils';

export interface CreateFieldInput {
  name: string;
  coords: LngLat[];
  locationLabel: string;
  country?: string;
  isSample?: boolean;
  soilTexture?: string;
  notes?: string;
  crop?: string;
  regionType?: RegionType;
  group?: string;
  color?: string;
}

interface FieldsState {
  fields: Field[];
  selectedFieldId: string | null;
  createField: (input: CreateFieldInput) => Field;
  updateField: (id: string, patch: Partial<Omit<Field, 'id'>>) => void;
  deleteField: (id: string) => void;
  selectField: (id: string | null) => void;
  getField: (id: string | null) => Field | null;
  /** Insert a fully-formed region (used to seed the demonstration region). */
  addField: (field: Field) => void;
}

export function buildBoundary(coords: LngLat[]): Field['boundary'] {
  const ring = closeRing(coords);
  return {
    coords: ring,
    areaM2: polygonAreaM2(ring),
    perimeterM: perimeterM(coords),
    centroid: centroidOf(coords),
    bbox: bboxOf(coords),
    vertexCount: coords.length,
  };
}

export const useFieldsStore = create<FieldsState>()(
  persist(
    (set, get) => ({
      fields: [],
      selectedFieldId: null,

      createField: (input) => {
        const field: Field = {
          id: uniqueId('field'),
          name: input.name,
          createdAt: new Date().toISOString(),
          status: 'draft',
          boundary: buildBoundary(input.coords),
          locationLabel: input.locationLabel,
          country: input.country,
          isSample: input.isSample,
          soilTexture: input.soilTexture,
          notes: input.notes,
          crop: input.crop,
          regionType: input.regionType,
          group: input.group,
          color: input.color,
        };
        set((state) => ({ fields: [field, ...state.fields], selectedFieldId: field.id }));
        return field;
      },

      updateField: (id, patch) =>
        set((state) => ({
          fields: state.fields.map((field) => (field.id === id ? { ...field, ...patch } : field)),
        })),

      deleteField: (id) =>
        set((state) => ({
          fields: state.fields.filter((field) => field.id !== id),
          selectedFieldId: state.selectedFieldId === id ? null : state.selectedFieldId,
        })),

      selectField: (id) => set({ selectedFieldId: id }),

      getField: (id) => {
        if (!id) return null;
        return get().fields.find((field) => field.id === id) ?? null;
      },

      addField: (field) =>
        set((state) => ({
          fields: state.fields.some((existing) => existing.id === field.id)
            ? state.fields
            : [field, ...state.fields],
        })),
    }),
    { name: 'agrisense.fields.v1', version: 1 },
  ),
);

export function useSelectedField(): Field | null {
  return useFieldsStore((state) =>
    state.selectedFieldId ? state.fields.find((f) => f.id === state.selectedFieldId) ?? null : null,
  );
}
