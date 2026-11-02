import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  Compass,
  Droplets,
  FileText,
  Globe2,
  Layers3,
  Leaf,
  Menu,
  Mountain,
  Sparkles,
  Sprout,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/Logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { SATELLITE_ATTRIBUTION } from '@/services/sources';
import { HAS_MAPBOX_TOKEN } from '@/components/map/earthMapSetup';
import { FieldContextBar } from '@/components/common/FieldContextBar';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Globe2;
  group: 'explore' | 'intelligence' | 'plan' | 'output';
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Earth Explorer', icon: Globe2, group: 'explore', description: 'Interactive 3D Earth and field drawing' },
  { to: '/fields', label: 'My Fields', icon: Layers3, group: 'explore', description: 'Saved field boundaries' },
  { to: '/intelligence', label: 'Field Intelligence', icon: Compass, group: 'intelligence', description: 'Overview, boundary and satellite preview' },
  { to: '/vegetation', label: 'Vegetation & NDVI', icon: Leaf, group: 'intelligence', description: 'Sentinel-2 vegetation health' },
  { to: '/soil', label: 'Soil Intelligence', icon: Mountain, group: 'intelligence', description: 'SoilGrids properties and texture' },
  { to: '/climate', label: 'Climate Intelligence', icon: Droplets, group: 'intelligence', description: 'Rainfall, temperature, ET₀ and moisture' },
  { to: '/crops', label: 'Crop Planning', icon: Sprout, group: 'plan', description: 'Rules-first crop suitability and zoning' },
  { to: '/calendar', label: 'Seasonal Calendar', icon: CalendarDays, group: 'plan', description: 'Rotation across spring, summer and rabi' },
  { to: '/decision', label: 'Decision Center', icon: Sparkles, group: 'plan', description: 'The 6:40 AM irrigation decision' },
  { to: '/reports', label: 'Reports', icon: FileText, group: 'output', description: 'Field-ready PDF export' },
];

const GROUP_LABELS: Record<NavItem['group'], string> = {
  explore: 'Explore',
  intelligence: 'Intelligence',
  plan: 'Plan',
  output: 'Output',
};

export function AppShell(): JSX.Element {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-full min-h-0 bg-background">
      {/* ------------------------------------------------------------- sidebar */}
      <aside
        className={cn(
          'shell-panel relative z-40 hidden shrink-0 flex-col border-r border-white/5 transition-[width] duration-300 lg:flex',
          collapsed ? 'w-[68px]' : 'w-[264px]',
        )}
      >
        <div className={cn('flex items-center gap-2 px-4 py-4', collapsed && 'justify-center px-2')}>
          <Logo
            showWordmark={!collapsed}
            tagline={collapsed ? undefined : 'Earth Intelligence'}
            invert
            className="min-w-0"
          />
        </div>

        <Separator className="bg-white/[0.07]" />

        <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-4" aria-label="Primary">
          {(Object.keys(GROUP_LABELS) as NavItem['group'][]).map((group) => {
            const items = NAV_ITEMS.filter((item) => item.group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="mb-5">
                {!collapsed ? (
                  <p className="mb-1.5 px-2.5 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-shell-muted/70">
                    {GROUP_LABELS[group]}
                  </p>
                ) : (
                  <Separator className="mb-3 bg-white/[0.06]" />
                )}
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
                    const link = (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                          collapsed && 'justify-center px-2',
                          active
                            ? 'bg-lime/12 text-lime shadow-inset'
                            : 'text-shell-foreground/72 hover:bg-white/[0.06] hover:text-shell-foreground',
                        )}
                      >
                        <item.icon className={cn('size-4 shrink-0', active ? 'text-lime' : 'text-shell-foreground/55')} />
                        {!collapsed ? <span className="truncate font-medium">{item.label}</span> : null}
                        {active && !collapsed ? (
                          <span className="ml-auto size-1.5 rounded-full bg-lime" aria-hidden />
                        ) : null}
                      </NavLink>
                    );
                    return (
                      <li key={item.to}>
                        {collapsed ? (
                          <Tooltip>
                            <TooltipTrigger asChild>{link}</TooltipTrigger>
                            <TooltipContent side="right">
                              <p className="font-medium">{item.label}</p>
                              <p className="mt-0.5 text-cream/60">{item.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          link
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className={cn('border-t border-white/[0.07] p-3', collapsed && 'px-2')}>
          {!collapsed ? (
            <div className="mb-2.5 rounded-lg border border-white/[0.07] bg-white/[0.03] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-shell-muted/70">
                  Map tiles
                </span>
                <Badge variant={HAS_MAPBOX_TOKEN ? 'lime' : 'muted'}>
                  {HAS_MAPBOX_TOKEN ? 'Mapbox' : 'Keyless'}
                </Badge>
              </div>
              <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-shell-muted">
                {HAS_MAPBOX_TOKEN
                  ? 'Mapbox token detected — commercial satellite imagery is available.'
                  : 'Running the keyless Sentinel-2 cloudless stack. Add VITE_MAPBOX_TOKEN for Mapbox imagery.'}
              </p>
            </div>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'w-full text-shell-muted hover:bg-white/[0.07] hover:text-shell-foreground',
              collapsed && 'px-0',
            )}
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <ChevronLeft className={cn('size-4 transition-transform', collapsed && 'rotate-180')} />
            {!collapsed ? <span>Collapse</span> : null}
          </Button>
        </div>
      </aside>

      {/* -------------------------------------------------------- mobile drawer */}
      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-forest-950/70 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="shell-panel fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col lg:hidden"
            >
              <div className="flex items-center justify-between px-4 py-4">
                <Logo tagline="Earth Intelligence" invert />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-shell-muted hover:bg-white/10 hover:text-shell-foreground"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                >
                  <X className="size-4" />
                </Button>
              </div>
              <Separator className="bg-white/[0.07]" />
              <nav className="flex-1 overflow-y-auto px-2.5 py-4" aria-label="Primary mobile">
                {(Object.keys(GROUP_LABELS) as NavItem['group'][]).map((group) => (
                  <div key={group} className="mb-5">
                    <p className="mb-1.5 px-2.5 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-shell-muted/70">
                      {GROUP_LABELS[group]}
                    </p>
                    <ul className="space-y-0.5">
                      {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                        const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
                        return (
                          <li key={item.to}>
                            <NavLink
                              to={item.to}
                              onClick={() => setMobileOpen(false)}
                              aria-current={active ? 'page' : undefined}
                              className={cn(
                                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                                active
                                  ? 'bg-lime/12 text-lime'
                                  : 'text-shell-foreground/72 hover:bg-white/[0.06] hover:text-shell-foreground',
                              )}
                            >
                              <item.icon className="size-4 shrink-0" />
                              <span className="truncate font-medium">{item.label}</span>
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </nav>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {/* ------------------------------------------------------------ main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background/85 px-3 backdrop-blur sm:px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <BarChart3 className="hidden size-4 text-lime sm:block" aria-hidden />
            <PageTitle pathname={location.pathname} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <FieldContextBar />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>

        <footer className="hidden shrink-0 items-center gap-2 border-t border-border/60 px-4 py-1.5 text-[0.625rem] text-muted-foreground/80 xl:flex">
          <span className="truncate">{SATELLITE_ATTRIBUTION}</span>
          <span className="ml-auto shrink-0 font-mono">AgriSense · Earth Intelligence for Agriculture</span>
        </footer>
      </div>
    </div>
  );
}

function PageTitle({ pathname }: { pathname: string }): JSX.Element {
  const match =
    pathname === '/'
      ? NAV_ITEMS[0]
      : [...NAV_ITEMS].sort((a, b) => b.to.length - a.to.length).find((item) => item.to !== '/' && pathname.startsWith(item.to));
  const item = match ?? NAV_ITEMS[0];
  return (
    <div className="min-w-0">
      <h1 className="truncate font-display text-sm font-semibold leading-tight">{item.label}</h1>
      <p className="hidden truncate text-[0.6875rem] text-muted-foreground sm:block">{item.description}</p>
    </div>
  );
}
