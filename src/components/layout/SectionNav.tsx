import { NavLink, useLocation } from 'react-router-dom';
import {
  Compass,
  Droplets,
  FileText,
  Leaf,
  MapPinned,
  Mountain,
  Sparkles,
  Sprout,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionItem {
  to: string;
  label: string;
  icon: typeof Compass;
}

/**
 * Workspace section navigation for the analysis and planning routes.
 *
 * Field Intelligence is deliberately split into focused, single-purpose pages
 * rather than one long scroll. This strip keeps that structure navigable and
 * makes the whole product read as one workspace.
 */
export const SECTION_ITEMS: SectionItem[] = [
  { to: '/intelligence', label: 'Field Overview', icon: Compass },
  { to: '/vegetation', label: 'Vegetation', icon: Leaf },
  { to: '/soil', label: 'Soil', icon: Mountain },
  { to: '/climate', label: 'Weather & Water', icon: Droplets },
  { to: '/crops', label: 'Crop Suitability', icon: Sprout },
  { to: '/studio', label: 'Planning Studio', icon: MapPinned },
  { to: '/calendar', label: 'Seasonal Plan', icon: CalendarDays },
  { to: '/decision', label: 'Risks & Decisions', icon: Sparkles },
  { to: '/reports', label: 'Report', icon: FileText },
];

function isActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Shown on every analysis/planning route, never on the Earth Explorer. */
export function SectionNav(): JSX.Element | null {
  const location = useLocation();
  const visible = SECTION_ITEMS.some((item) => isActive(location.pathname, item.to));
  if (!visible) return null;

  return (
    <div className="border-b border-border/60 bg-card/60 backdrop-blur">
      <nav aria-label="Workspace sections" className="mx-auto max-w-[1600px] px-3 sm:px-4">
        <ul className="flex items-stretch gap-0.5 overflow-x-auto">
          {SECTION_ITEMS.map((item) => {
            const active = isActive(location.pathname, item.to);
            return (
              <li key={item.to} className="shrink-0">
                <NavLink
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center gap-1.5 whitespace-nowrap px-2.5 py-2.5 text-xs font-medium transition-colors',
                    active ? 'text-forest-800' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <item.icon className="size-[0.9375rem] shrink-0" aria-hidden />
                  {item.label}
                  {active ? (
                    <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-lime-600" aria-hidden />
                  ) : null}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
