import { LogoMark } from '@/components/brand/Logo';

export function LoadingScreen({ message = 'Preparing Earth intelligence' }: { message?: string }): JSX.Element {
  return (
    <div className="relative flex h-full min-h-[60vh] w-full items-center justify-center overflow-hidden bg-forest-950">
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime/[0.06] blur-3xl" />
      <div className="relative flex flex-col items-center gap-5">
        <div className="relative">
          <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-lime/40" />
          <LogoMark className="size-14 rounded-2xl shadow-float" />
        </div>
        <div className="text-center">
          <p className="font-display text-lg font-semibold text-cream">
            Agri<span className="text-lime">Sense</span>
          </p>
          <p className="mt-1 text-2xs uppercase tracking-[0.18em] text-shell-muted">{message}</p>
        </div>
        <div className="h-0.5 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/3 animate-[agrisense-scan_1.6s_ease-in-out_infinite] rounded-full bg-lime" />
        </div>
      </div>
    </div>
  );
}
