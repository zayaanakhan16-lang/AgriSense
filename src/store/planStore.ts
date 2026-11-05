import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uniqueId } from '@/lib/utils';

/** A crop allocation inside a scenario. Geometry is derived from the share. */
export interface PlanZoneSpec {
  id: string;
  cropId: string;
  /** Fraction of the usable field area, 0..1. Shares in a scenario sum to 1. */
  share: number;
}

export interface PlanScenario {
  id: string;
  name: string;
  fieldId: string;
  zones: PlanZoneSpec[];
  createdAt: string;
}

interface PlanState {
  scenarios: PlanScenario[];
  activeId: string | null;
  /** Per-scenario undo stack of zone snapshots. */
  history: Record<string, PlanZoneSpec[][]>;
  createScenario: (fieldId: string, name: string, zones: PlanZoneSpec[]) => string;
  setActive: (id: string) => void;
  renameScenario: (id: string, name: string) => void;
  deleteScenario: (id: string) => void;
  updateZones: (zones: PlanZoneSpec[], record?: boolean) => void;
  undo: () => void;
  scenariosForField: (fieldId: string) => PlanScenario[];
}

/** Normalise shares so they always sum to exactly 1. */
export function normaliseShares(zones: PlanZoneSpec[]): PlanZoneSpec[] {
  const total = zones.reduce((acc, zone) => acc + Math.max(0, zone.share), 0);
  if (total <= 0) {
    const even = zones.length ? 1 / zones.length : 0;
    return zones.map((zone) => ({ ...zone, share: even }));
  }
  return zones.map((zone) => ({ ...zone, share: Math.max(0, zone.share) / total }));
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      scenarios: [],
      activeId: null,
      history: {},

      createScenario: (fieldId, name, zones) => {
        const scenario: PlanScenario = {
          id: uniqueId('plan'),
          name,
          fieldId,
          zones: normaliseShares(zones),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          scenarios: [...state.scenarios, scenario],
          activeId: scenario.id,
          history: { ...state.history, [scenario.id]: [] },
        }));
        return scenario.id;
      },

      setActive: (id) => set({ activeId: id }),

      renameScenario: (id, name) =>
        set((state) => ({
          scenarios: state.scenarios.map((scenario) => (scenario.id === id ? { ...scenario, name } : scenario)),
        })),

      deleteScenario: (id) =>
        set((state) => {
          const scenarios = state.scenarios.filter((scenario) => scenario.id !== id);
          const history = { ...state.history };
          delete history[id];
          return {
            scenarios,
            history,
            activeId: state.activeId === id ? scenarios[scenarios.length - 1]?.id ?? null : state.activeId,
          };
        }),

      updateZones: (zones, record = true) =>
        set((state) => {
          const activeId = state.activeId;
          if (!activeId) return state;
          const scenario = state.scenarios.find((s) => s.id === activeId);
          if (!scenario) return state;
          const history = record
            ? { ...state.history, [activeId]: [...(state.history[activeId] ?? []).slice(-24), scenario.zones] }
            : state.history;
          return {
            history,
            scenarios: state.scenarios.map((s) => (s.id === activeId ? { ...s, zones: normaliseShares(zones) } : s)),
          };
        }),

      undo: () =>
        set((state) => {
          const activeId = state.activeId;
          if (!activeId) return state;
          const stack = state.history[activeId] ?? [];
          if (!stack.length) return state;
          const previous = stack[stack.length - 1];
          return {
            history: { ...state.history, [activeId]: stack.slice(0, -1) },
            scenarios: state.scenarios.map((s) => (s.id === activeId ? { ...s, zones: previous } : s)),
          };
        }),

      scenariosForField: (fieldId) => get().scenarios.filter((scenario) => scenario.fieldId === fieldId),
    }),
    { name: 'agrisense.plans.v1', version: 1 },
  ),
);
