import * as React from 'react';

import { cn } from '../lib/utils';

// forwardRef for the same reason as the plugin Input: the Free edition runs on
// WordPress's React 18, which does not pass `ref` through props, so a plain
// function component drops every ref a caller hands it.
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        'border-input bg-background text-foreground placeholder:text-muted-foreground/70 dark:bg-input/30 dark:placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex min-h-24 w-full resize-y rounded-md border px-3 py-2 text-sm shadow-xs transition-[border-color,box-shadow,color,background-color] outline-none focus-visible:ring-[2px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-[2px]',
        className,
      )}
      {...props}
    />
  );
});

export { Textarea };
