'use client';

/**
 * Plugin-specific Tooltip Component
 *
 * This component wraps the standard shadcn Tooltip to ensure that theme CSS
 * variables are properly applied to portal content.
 */
import * as React from 'react';

import { Tooltip as TooltipPrimitive } from 'radix-ui';

import { cn } from '../lib/utils';
import { useThemeClass } from './hooks/use-theme-class';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipPortal = TooltipPrimitive.Portal;

interface TooltipContentProps extends React.ComponentPropsWithRef<
  typeof TooltipPrimitive.Content
> {
  container?: HTMLElement | null;
}

const TooltipContent: React.FC<TooltipContentProps> = ({
  className,
  sideOffset = 4,
  ...props
}) => {
  const { themeClass, isDark, style } = useThemeClass();

  // Dark mode CSS uses `.dark .theme-class` selector, so we need nested wrappers
  const tooltipContent = (
    <div className={themeClass} data-pm-portal style={style}>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'border-border bg-background text-foreground z-[9999] overflow-hidden rounded-md border px-2 py-1.5 text-xs font-semibold shadow-lg',
          className,
        )}
        {...props}
      />
    </div>
  );

  return (
    <TooltipPortal>
      {/* Outer wrapper for dark mode - CSS uses `.dark .theme-class` selector */}
      <div className={isDark ? 'dark' : undefined}>{tooltipContent}</div>
    </TooltipPortal>
  );
};
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
};
