import * as React from 'react';

import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '../lib/utils';

const planBadgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      plan: {
        free: 'border-border bg-secondary text-muted-foreground',
        pro: 'border-primary/30 bg-primary/10 text-primary',
        ultimate: 'border-brand-gold/30 bg-brand-gold/10 text-brand-gold',
        starter: 'border-brand-purple/30 bg-brand-purple/10 text-brand-purple',
      },
    },
    defaultVariants: {
      plan: 'free',
    },
  },
);

export interface PlanBadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof planBadgeVariants> {
  /**
   * The plan tier to display
   */
  plan: 'free' | 'pro' | 'ultimate' | 'starter';
  /**
   * Optional custom label (defaults to capitalized plan name)
   */
  label?: string;
}

function PlanBadge({ className, plan, label, ...props }: PlanBadgeProps) {
  const displayLabel =
    label ||
    {
      free: 'Free',
      pro: 'Pro',
      ultimate: 'Ultimate',
      starter: 'Starter',
    }[plan];

  return (
    <div className={cn(planBadgeVariants({ plan }), className)} {...props}>
      {displayLabel}
    </div>
  );
}

export { PlanBadge, planBadgeVariants };
