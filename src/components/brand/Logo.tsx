import { cn } from '@/lib/utils';

export interface LogoMarkProps {
  className?: string;
  /** Accessible label; pass an empty string when the mark is decorative. */
  title?: string;
  /** Unique suffix so multiple marks on one page do not share gradient ids. */
  idSuffix?: string;
}

/**
 * The AgriSense mark: a sprouting leaf read as a field parcel inside a
 * satellite swath. Drawn entirely in the brand palette so it stays crisp
 * from 20px favicon size up to the loading screen.
 */
export function LogoMark({ className, title = 'AgriSense', idSuffix = 'a' }: LogoMarkProps): JSX.Element {
  const bg = `as-bg-${idSuffix}`;
  const leaf = `as-leaf-${idSuffix}`;
  const glow = `as-glow-${idSuffix}`;
  const clip = `as-clip-${idSuffix}`;

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
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#01392b" />
          <stop offset="1" stopColor="#020d05" />
        </linearGradient>
        <linearGradient id={leaf} x1="0.2" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#d7fa54" />
          <stop offset="0.5" stopColor="#9edb02" />
          <stop offset="1" stopColor="#6ed301" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.42" r="0.62">
          <stop offset="0" stopColor="#6ed301" stopOpacity="0.42" />
          <stop offset="1" stopColor="#6ed301" stopOpacity="0" />
        </radialGradient>
        <clipPath id={clip}>
          <rect x="0" y="0" width="64" height="64" rx="15" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect x="0" y="0" width="64" height="64" fill={`url(#${bg})`} />
        <circle cx="32" cy="27" r="26" fill={`url(#${glow})`} />
        {/* satellite swath arcs */}
        <path d="M-4 43 Q32 60 68 43" fill="none" stroke="#6ed301" strokeOpacity="0.4" strokeWidth="1.6" />
        <path d="M-4 50 Q32 66 68 50" fill="none" stroke="#5f8525" strokeOpacity="0.45" strokeWidth="1.2" />
        {/* parcel outline */}
        <path
          d="M18 46 L18 30 L32 21 L46 30 L46 46 Z"
          fill="none"
          stroke="#9edb02"
          strokeOpacity="0.34"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {/* sprout */}
        <path
          d="M32 20 C41.6 26.4 41.6 38.4 32 44 C22.4 38.4 22.4 26.4 32 20 Z"
          fill={`url(#${leaf})`}
        />
        <path d="M32 23.5 V42" stroke="#01392b" strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
        <path
          d="M32 28.5 L36.6 31.4 M32 34.5 L37 37.4 M32 28.5 L27.4 31.4 M32 34.5 L27 37.4"
          stroke="#01392b"
          strokeOpacity="0.34"
          strokeWidth="1.25"
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
