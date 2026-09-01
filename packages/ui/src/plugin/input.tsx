import * as React from 'react';

import { Input as InputPrimitive } from '@base-ui/react/input';

import { cn } from '../lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // The `!` on the touch floor is load-bearing. WordPress core's forms.css
        // sets `min-height:40px` on every text input and select, and it is
        // UNLAYERED: an unlayered normal declaration beats anything in Tailwind's
        // @layer utilities no matter how specific, so a plain `min-h-11` silently
        // resolves to 40px. An important declaration is the one thing that wins.
        // The same rule is why `py-1` computes to zero padding in wp-admin.
        'border-input bg-background text-foreground placeholder:text-muted-foreground/70 dark:bg-input/30 dark:placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 file:text-foreground flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-sm shadow-xs transition-[border-color,box-shadow,color,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-[2px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-[2px] max-sm:min-h-11!',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
