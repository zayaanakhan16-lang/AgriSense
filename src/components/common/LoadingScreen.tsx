import { LogoMark } from '@/components/brand/Logo';

/**
 * Route-level suspense fallback. Intentionally minimal: no full-screen logo
 * animation, no artificial delay, no fake progress. The shell is already
 * mounted when this appears, so it only fills the content area briefly while
 * a lazily-loaded route chunk resolves.
 */
export function LoadingScreen({ message = 'Loading workspace' }: { message?: string }): JSX.Element {
  return (
    <div className="flex h-full min-h-[40vh] w-full items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="relative flex size-5 items-center justify-center">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-lime-600" />
        </span>
        <span className="text-xs font-medium">{message}…</span>
      </div>
    </div>
  );
}

/** Compact inline indicator for a loading panel or map. */
export function MapLoadingIndicator({ label = 'Loading imagery' }: { label?: string }): JSX.Element {
  return (
    <div className="flex items-center gap-2 text-2xs text-cream/60">
      <span className="relative flex size-3.5 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-lime" />
      </span>
      <span>{label}…</span>
    </div>
  );
}

export { LogoMark };
