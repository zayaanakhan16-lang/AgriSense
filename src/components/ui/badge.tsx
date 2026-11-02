import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-2xs font-semibold uppercase tracking-[0.08em] transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        lime: 'border-lime/40 bg-lime/15 text-lime-300',
        outline: 'border-border text-muted-foreground',
        success: 'border-emerald-500/35 bg-emerald-500/12 text-emerald-300',
        warning: 'border-amber-500/35 bg-amber-500/12 text-amber-300',
        danger: 'border-red-500/35 bg-red-500/12 text-red-300',
        muted: 'border-border/60 bg-muted/60 text-muted-foreground',
        info: 'border-sky-500/35 bg-sky-500/12 text-sky-300',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps): JSX.Element {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
