'use client';

/**
 * Plugin-specific Popover Component
 *
 * This component wraps the standard shadcn Popover to ensure that theme CSS
 * variables are properly applied to portal content.
 */
import * as React from 'react';

import { Popover as PopoverPrimitive } from 'radix-ui';

import { cn } from '../lib/utils';
import { useThemeClass } from './hooks/use-theme-class';

const Popover = PopoverPrimitive.Root;

/**
 * Default chrome for a trigger this component renders itself.
 *
 * It is NOT applied under `asChild`. There the caller supplies the element and
 * its styling, and this string could only fight it: `cn()` tailwind-merges
 * these against the trigger's OWN className, but Radix's Slot merges in the
 * child's by concatenation, so tailwind-merge never sees that conflict and
 * both classes land. Resolution then falls to stylesheet order (`.h-9` is
 * emitted late), so every `asChild` trigger in the plugin rendered 36px tall
 * no matter what height its child asked for: 24px folder actions, 28px
 * composer toolbar buttons, 32px header buttons. `rounded-md` and
 * `hover:bg-card` were overriding children the same way.
 */
const TRIGGER_CHROME =
  'bg-card text-foreground hover:bg-card focus-visible:border-ring focus-visible:ring-ring/30 h-9 rounded-md transition-[border-color,box-shadow,color,background-color] outline-none focus-visible:ring-[2px]';

const PopoverTrigger: React.FC<
  React.ComponentProps<typeof PopoverPrimitive.Trigger>
> = ({ className, asChild, ...props }) => (
  <PopoverPrimitive.Trigger
    asChild={asChild}
    className={asChild ? className : cn(TRIGGER_CHROME, className)}
    {...props}
  />
);
PopoverTrigger.displayName = PopoverPrimitive.Trigger.displayName;
const PopoverAnchor = PopoverPrimitive.Anchor;
const PopoverClose = PopoverPrimitive.Close;
const PopoverArrow = PopoverPrimitive.Arrow;

const PopoverContent: React.FC<
  React.ComponentProps<typeof PopoverPrimitive.Content>
> = ({ className, align = 'center', sideOffset = 4, ...props }) => {
  const { themeClass, isDark, style } = useThemeClass();

  // Dark mode CSS uses `.dark .theme-class` selector, so we need nested wrappers
  const popoverContent = (
    <div className={themeClass} data-pm-portal style={style}>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'bg-popover text-popover-foreground border-border z-50 max-h-[min(var(--radix-popover-content-available-height),80vh)] w-72 overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-lg outline-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className,
        )}
        {...props}
      />
    </div>
  );

  return (
    <PopoverPrimitive.Portal>
      {/* Outer wrapper for dark mode - CSS uses `.dark .theme-class` selector */}
      <div className={isDark ? 'dark' : undefined}>{popoverContent}</div>
    </PopoverPrimitive.Portal>
  );
};

PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverClose,
  PopoverArrow,
};
