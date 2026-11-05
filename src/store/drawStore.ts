import { create } from 'zustand';
import type { LngLat } from '@/types';
import { polygonAreaM2, perimeterM, bboxOf, centroidOf, closeRing, haversineM } from '@/lib/geo';

export type DrawMode = 'idle' | 'drawing' | 'closed' | 'editing';

interface DrawState {
  mode: DrawMode;
  /** Vertices in drawing order; the ring is not repeated while drawing. */
  points: LngLat[];
  /** Live cursor position used to render the rubber-band segment. */
  hover: LngLat | null;
  /** Index of the vertex currently being dragged while editing. */
  activeVertex: number | null;
  /** Minimum geodesic distance (m) between consecutive vertices. */
  minVertexSpacingM: number;
  start: () => void;
  addPoint: (point: LngLat) => void;
  setHover: (point: LngLat | null) => void;
  undo: () => void;
  cancel: () => void;
  close: () => void;
  reset: () => void;
  /* vertex editing */
  startEditing: () => void;
  finishEditing: () => void;
  setActiveVertex: (index: number | null) => void;
  moveVertex: (index: number, point: LngLat) => void;
  removeVertex: (index: number) => void;
  insertVertex: (afterIndex: number, point: LngLat) => void;
}

export const useDrawStore = create<DrawState>((set, get) => ({
  mode: 'idle',
  points: [],
  hover: null,
  activeVertex: null,
  minVertexSpacingM: 1.5,

  start: () => set({ mode: 'drawing', points: [], hover: null, activeVertex: null }),

  addPoint: (point) => {
    const { points, mode, minVertexSpacingM } = get();
    if (mode !== 'drawing') return;
    const last = points[points.length - 1];
    if (last && haversineM(last, point) < minVertexSpacingM) return;
    set({ points: [...points, point] });
  },

  setHover: (hover) => set({ hover }),

  undo: () =>
    set((state) => {
      if (state.points.length <= 1) return { points: [], mode: 'idle', hover: null };
      return { points: state.points.slice(0, -1) };
    }),

  cancel: () => set({ mode: 'idle', points: [], hover: null, activeVertex: null }),

  close: () => {
    const { points } = get();
    if (points.length < 3) return;
    set({ mode: 'closed', points, hover: null, activeVertex: null });
  },

  reset: () => set({ mode: 'idle', points: [], hover: null, activeVertex: null }),

  startEditing: () => {
    const { points, mode } = get();
    if (points.length < 3 || (mode !== 'closed' && mode !== 'editing')) return;
    set({ mode: 'editing', activeVertex: null });
  },

  finishEditing: () => set({ mode: 'closed', activeVertex: null }),

  setActiveVertex: (index) => set({ activeVertex: index }),

  moveVertex: (index, point) =>
    set((state) => {
      if (index < 0 || index >= state.points.length) return state;
      const points = [...state.points];
      points[index] = point;
      return { points };
    }),

  removeVertex: (index) =>
    set((state) => {
      if (state.points.length <= 3) return state;
      const points = state.points.filter((_, i) => i !== index);
      return { points, activeVertex: null };
    }),

  insertVertex: (afterIndex, point) =>
    set((state) => {
      const points = [...state.points];
      points.splice(afterIndex + 1, 0, point);
      return { points };
    }),
}));

export interface DrawMetrics {
  areaM2: number;
  perimeterM: number;
  vertexCount: number;
  centroid: LngLat | null;
  bbox: [number, number, number, number] | null;
}

/** Live geodesic metrics for the in-progress polygon. */
export function computeDrawMetrics(points: LngLat[]): DrawMetrics {
  if (points.length < 3) {
    return {
      areaM2: 0,
      perimeterM: points.length >= 2 ? perimeterM(points) : 0,
      vertexCount: points.length,
      centroid: points.length ? centroidOf(points) : null,
      bbox: points.length ? bboxOf(points) : null,
    };
  }
  const ring = closeRing(points);
  return {
    areaM2: polygonAreaM2(ring),
    perimeterM: perimeterM(points),
    vertexCount: points.length,
    centroid: centroidOf(points),
    bbox: bboxOf(points),
  };
}
