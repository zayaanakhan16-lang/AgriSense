import { create } from 'zustand';
import type { LngLat } from '@/types';
import { polygonAreaM2, perimeterM, bboxOf, centroidOf, closeRing, haversineM } from '@/lib/geo';

export type DrawMode = 'idle' | 'drawing' | 'closed';

interface DrawState {
  mode: DrawMode;
  /** Vertices in drawing order; the ring is not repeated while drawing. */
  points: LngLat[];
  /** Live cursor position used to render the rubber-band segment. */
  hover: LngLat | null;
  /** Minimum geodesic distance (m) between consecutive vertices. */
  minVertexSpacingM: number;
  start: () => void;
  addPoint: (point: LngLat) => void;
  setHover: (point: LngLat | null) => void;
  undo: () => void;
  cancel: () => void;
  close: () => void;
  reset: () => void;
}

export const useDrawStore = create<DrawState>((set, get) => ({
  mode: 'idle',
  points: [],
  hover: null,
  minVertexSpacingM: 1.5,

  start: () => set({ mode: 'drawing', points: [], hover: null }),

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

  cancel: () => set({ mode: 'idle', points: [], hover: null }),

  close: () => {
    const { points } = get();
    if (points.length < 3) return;
    set({ mode: 'closed', points, hover: null });
  },

  reset: () => set({ mode: 'idle', points: [], hover: null }),
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
