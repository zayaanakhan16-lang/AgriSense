import { cn } from '@/lib/utils';

const LOGO_SRC = '/brand/agrisense-logo.png';

export interface LogoMarkProps {
  className?: string;
  /** Accessible label; pass an empty string when the mark is decorative. */
  title?: string;
}

/** The AgriSense brand mark. */
export function LogoMark({ className, title = 'AgriSense' }: LogoMarkProps): JSX.Element {
  return (
    <img
      src={LOGO_SRC}
      alt={title}
      aria-hidden={title ? undefined : true}
      className={cn('shrink-0 object-contain', className)}
    />
  );
}

export interface LogoProps {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  tagline?: string;
  invert?: boolean;
}

export function Logo({
  className,
  markClassName,
  showWordmark = true,
  tagline,
  invert = false,
}: LogoProps): JSX.Element {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark className={cn('size-8 rounded-xl shadow-panel', markClassName)} />
      {showWordmark ? (
        <div className="min-w-0 leading-none">
          <div
            className={cn(
              'font-display text-[1.0625rem] font-bold tracking-[-0.03em]',
              invert ? 'text-cream' : 'text-foreground',
            )}
          >
            Agri<span className="text-lime">Sense</span>
          </div>
          {tagline ? (
            <div className="mt-1 text-3xs font-semibold uppercase tracking-[0.18em] text-shell-muted">{tagline}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
