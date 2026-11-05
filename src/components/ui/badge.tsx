import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-2xs font-semibold uppercase tracking-[0.08em] transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        lime: 'border-lime-600/45 bg-lime/20 text-lime',
        outline: 'border-border text-muted-foreground',
        success: 'border-lime-600/40 bg-lime/15 text-lime',
        warning: 'border-amber-600/35 bg-amber-500/12 text-amber-300',
        danger: 'border-red-600/35 bg-red-500/10 text-red-300',
        muted: 'border-border/60 bg-muted/60 text-muted-foreground',
        info: 'border-lime-600/25 bg-lime/10 text-lime',
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
