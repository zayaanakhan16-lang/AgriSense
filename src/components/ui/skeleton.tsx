import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn('skeleton h-4 w-full', className)} {...props} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }): JSX.Element {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={index === lines - 1 ? 'w-2/3' : 'w-full'} />
      ))}
    </div>
  );
}
