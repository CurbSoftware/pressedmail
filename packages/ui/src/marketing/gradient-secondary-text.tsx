import React from 'react';

import { Slot } from 'radix-ui';

import { cn } from '../lib/utils';

export const GradientSecondaryText: React.FC<
  React.HTMLAttributes<HTMLSpanElement> & {
    asChild?: boolean;
  }
> = function GradientSecondaryTextComponent({ className, asChild, children, ...props }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      className={cn(
        'dark:from-foreground/60 dark:to-foreground text-secondary-foreground dark:bg-linear-to-r dark:bg-clip-text dark:text-transparent',
        className,
      )}
      {...props}
    >
      <Slot.Slottable>{children}</Slot.Slottable>
    </Comp>
  );
};
