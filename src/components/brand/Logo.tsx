import { cn } from '@/lib/utils';

export interface LogoMarkProps {
  className?: string;
  /** Accessible label; pass an empty string when the mark is decorative. */
  title?: string;
}

/**
 * The AgriSense mark: a leaf standing in for a field, ringed by an orbit that
 * reads as an Earth-observation swath. Original proportions are preserved.
 */
export function LogoMark({ className, title = 'AgriSense' }: LogoMarkProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('shrink-0', className)}
      role={title ? 'img' : 'presentation'}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id="as-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00513D" />
          <stop offset="1" stopColor="#003B2F" />
        </linearGradient>
        <linearGradient id="as-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#D7FF54" />
          <stop offset="1" stopColor="#A8E600" />
        </linearGradient>
        <clipPath id="as-badge">
          <rect x="0" y="0" width="64" height="64" rx="16" />
        </clipPath>
      </defs>
      <g clipPath="url(#as-badge)">
        <rect x="0" y="0" width="64" height="64" fill="url(#as-bg)" />
        <path d="M-6 46 Q32 62 70 46" fill="none" stroke="#A8E600" strokeOpacity="0.55" strokeWidth="2.4" />
        <circle cx="32" cy="32" r="19" fill="none" stroke="#A8E600" strokeOpacity="0.28" strokeWidth="1.5" />
        <path d="M32 13 C43.5 21.5 43.5 39.5 32 48 C20.5 39.5 20.5 21.5 32 13 Z" fill="url(#as-leaf)" />
        <path d="M32 16 V45" stroke="#003B2F" strokeOpacity="0.45" strokeWidth="1.7" strokeLinecap="round" />
        <path
          d="M32 24 L37.4 27.6 M32 32 L38 35.6 M32 24 L26.6 27.6 M32 32 L26 35.6"
          stroke="#003B2F"
          strokeOpacity="0.32"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </g>
    </svg>
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
      <LogoMark className={cn('size-8 rounded-lg shadow-panel', markClassName)} />
      {showWordmark ? (
        <div className="min-w-0 leading-none">
          <div
            className={cn(
              'font-display text-[1.0625rem] font-semibold tracking-tight',
              invert ? 'text-cream' : 'text-foreground',
            )}
          >
            Agri<span className="text-lime">Sense</span>
          </div>
          {tagline ? (
            <div className="mt-1 text-2xs font-medium uppercase tracking-[0.16em] text-shell-muted">{tagline}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
