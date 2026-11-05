import { lazy, type LazyExoticComponent } from 'react';
import {
  Droplets,
  FileText,
  Gauge,
  Leaf,
  MapPinned,
  Mountain,
  ShieldAlert,
  Sprout,
} from 'lucide-react';

export interface AnalyticsSection {
  id: string;
  label: string;
  icon: typeof Gauge;
  description: string;
  /** `null` for the Overview tab, which is rendered inline by the analytics page. */
  Page: LazyExoticComponent<() => JSX.Element> | null;
}

/**
 * Sections of the Region Analytics workspace.
 *
 * These were separate top-level pages before the product was collapsed to two
 * workspaces (Map and Analytics). They are kept as their own modules and loaded
 * lazily, so only the section the user opens is fetched.
 *
 * Crop profiles, suitability, planning and the seasonal rotation all describe the
 * same crop decision, so they are grouped under the single "Crops" section rather
 * than repeated as sibling tabs.
 */
export const ANALYTICS_SECTIONS: AnalyticsSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: Gauge,
    description: 'Weather, precipitation, air and water quality, land use and allocation',
    Page: null,
  },
  {
    id: 'crops',
    label: 'Crops',
    icon: Sprout,
    description: 'Crop profiles, suitability comparison, planning and rotation',
    Page: lazy(() => import('@/features/analytics/CropsSection')),
  },
  {
    id: 'vegetation',
    label: 'Vegetation',
    icon: Leaf,
    description: 'Sentinel-2 vegetation health and NDVI',
    Page: lazy(() => import('@/features/vegetation/VegetationPage')),
  },
  {
    id: 'soil',
    label: 'Soil',
    icon: Mountain,
    description: 'SoilGrids properties, texture and depth',
    Page: lazy(() => import('@/features/soil/SoilPage')),
  },
  {
    id: 'climate',
    label: 'Weather & Water',
    icon: Droplets,
    description: 'Rainfall, temperature, ET0 and water balance',
    Page: lazy(() => import('@/features/climate/ClimatePage')),
  },
  {
    id: 'studio',
    label: 'Planning Studio',
    icon: MapPinned,
    description: 'Spatial allocation of crops across zones',
    Page: lazy(() => import('@/features/studio/CropStudioPage')),
  },
  {
    id: 'decision',
    label: 'Risks & Decisions',
    icon: ShieldAlert,
    description: 'Irrigation decision and risk guardrails',
    Page: lazy(() => import('@/features/decision/DecisionCenterPage')),
  },
  {
    id: 'reports',
    label: 'Report',
    icon: FileText,
    description: 'Field-ready PDF export',
    Page: lazy(() => import('@/features/reports/ReportsPage')),
  },
];

export const DEFAULT_SECTION_ID = ANALYTICS_SECTIONS[0].id;

export function isSectionId(value: string | null): value is string {
  return value !== null && ANALYTICS_SECTIONS.some((section) => section.id === value);
}
