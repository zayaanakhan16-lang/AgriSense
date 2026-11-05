import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Globe2, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FieldContextBar } from '@/components/common/FieldContextBar';

interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: typeof Globe2;
  description: string;
}

/**
 * The product is two workspaces: the map you draw regions on, and the analytics
 * workspace that reports on the selected region. Everything that used to be a
 * separate top-level page — soil, crops, planning, calendar, decisions, reports —
 * is now a section inside analytics, so this list stays deliberately short.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Earth Explorer', short: 'Map', icon: Globe2, description: 'Interactive 3D Earth and region drawing' },
  { to: '/analytics', label: 'Region Analytics', short: 'Analytics', icon: BarChart3, description: 'Weather, soil, crops, planning and reports for the selected region' },
];

function isActive(pathname: string, to: string): boolean {
  return to === '/' ? pathname === '/' : pathname.startsWith(to);
}

function useActiveItem(pathname: string): NavItem {
  const match = [...NAV_ITEMS]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => isActive(pathname, item.to));
  return match ?? NAV_ITEMS[0];
}

/**
 * Premium app shell: a slim fixed top bar over a full-bleed workspace.
 * The Earth Explorer and the drawing workspace get the entire viewport below
 * the bar, which is what makes the globe feel like the centre of the product.
 */
export function AppShell(): JSX.Element {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const activeItem = useActiveItem(location.pathname);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* ------------------------------------------------------------- top bar */}
      <header
        className={cn(
          'relative z-40 flex h-14 shrink-0 items-center gap-3 border-b px-3 transition-colors sm:px-4',
          'border-white/10 bg-forest-900 text-cream',
          scrolled && 'shadow-panel',
        )}
      >
        <Logo showWordmark invert markClassName="size-8" className="shrink-0" />

        <Separator className="hidden h-6 w-px bg-white/12 md:block" />

        {/* primary navigation */}
        <nav aria-label="Primary" className="hidden min-w-0 flex-1 md:block">
          <ul className="flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(location.pathname, item.to);
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[0.8125rem] font-medium transition-colors',
                      active ? 'text-cream' : 'text-cream/60 hover:text-cream',
                    )}
                  >
                    <item.icon className="size-[0.9375rem] shrink-0" aria-hidden />
                    <span className="hidden lg:inline">{item.short}</span>
                    {active ? (
                      <span className="absolute inset-x-2 -bottom-[0.4rem] h-0.5 rounded-full bg-lime" aria-hidden />
                    ) : null}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* mobile: current page label */}
        <div className="min-w-0 flex-1 md:hidden">
          <p className="truncate font-display text-sm font-semibold text-cream">
            {activeItem.label}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:block">
            <FieldContextBar />
          </div>
          <Button
            variant="shell"
            size="icon-sm"
            className="border border-white/10 md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </Button>
        </div>
      </header>

      {/* -------------------------------------------------------- mobile drawer */}
      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-forest-950/70 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 340 }}
              className="shell-panel fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col md:hidden"
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
                <ul className="space-y-0.5">
                  {NAV_ITEMS.map((item) => {
                    const active = isActive(location.pathname, item.to);
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm transition-colors',
                            active
                              ? 'bg-lime/12 text-lime-300 shadow-inset'
                              : 'text-shell-foreground/72 hover:bg-white/[0.06] hover:text-shell-foreground',
                          )}
                        >
                          <item.icon className="size-4 shrink-0" />
                          <span className="truncate font-medium">{item.label}</span>
                          {active ? <span className="ml-auto size-1.5 rounded-full bg-lime" aria-hidden /> : null}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <div className="border-t border-white/[0.07] p-3">
                <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-2">
                  <LogoMark className="size-6 rounded-md" title="" />
                  <p className="text-2xs leading-relaxed text-shell-muted">
                    Keyless open-source mapping. No API keys required.
                  </p>
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {/* ------------------------------------------------------------ workspace */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/** Compact page heading used by the non-map intelligence pages. */
export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="type-title">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl type-meta">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
