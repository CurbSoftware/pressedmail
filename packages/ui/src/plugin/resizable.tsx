'use client';

import * as React from 'react';

import { DragHandleDots2Icon } from '@radix-ui/react-icons';
import * as ResizablePrimitive from 'react-resizable-panels';

import { cn } from '../lib/utils';

/**
 * Convert a numeric size value to a percentage string.
 * react-resizable-panels v4.7.1 treats bare numbers as pixels;
 * our layouts pass numbers meaning percentages.
 */
function toPercent(val: number | string | undefined): string | undefined {
  if (val === undefined) return undefined;
  if (typeof val === 'string') return val;
  return `${val}%`;
}

/**
 * Compatibility bridge for react-resizable-panels v4.7.1.
 * Accepts the old v2.x props (`direction`, `onLayout`) and maps them
 * to the new API (`orientation`, `onLayoutChange`).
 */
interface ResizablePanelGroupProps
  extends Omit<
    React.ComponentPropsWithRef<typeof ResizablePrimitive.Group>,
    'orientation' | 'onLayoutChange'
  > {
  /** Layout orientation (v4.7.1 name) */
  orientation?: 'horizontal' | 'vertical';
  /** @deprecated v2.x compat: mapped to `orientation` */
  direction?: 'horizontal' | 'vertical';
  /** Layout change callback (v4.7.1 name) */
  onLayoutChange?: React.ComponentPropsWithRef<
    typeof ResizablePrimitive.Group
  >['onLayoutChange'];
  /** @deprecated v2.x compat: called with number[] converted from Layout object */
  onLayout?: (sizes: number[]) => void;
}

const ResizablePanelGroup: React.FC<ResizablePanelGroupProps> = ({
  className,
  direction,
  orientation,
  onLayout,
  onLayoutChange,
  ...props
}) => (
  <ResizablePrimitive.Group
    orientation={orientation ?? direction ?? 'horizontal'}
    onLayoutChange={
      onLayoutChange ??
      (onLayout
        ? (layout: Record<string, number>) => {
            onLayout(Object.values(layout));
          }
        : undefined)
    }
    className={cn('flex h-full w-full', className)}
    {...props}
  />
);

interface ResizablePanelProps
  extends Omit<
    React.ComponentPropsWithRef<typeof ResizablePrimitive.Panel>,
    'defaultSize' | 'minSize' | 'maxSize' | 'collapsedSize'
  > {
  defaultSize?: number | string;
  minSize?: number | string;
  maxSize?: number | string;
  collapsedSize?: number | string;
}

const ResizablePanel: React.FC<ResizablePanelProps> = ({
  defaultSize,
  minSize,
  maxSize,
  collapsedSize,
  ...rest
}) => (
  <ResizablePrimitive.Panel
    defaultSize={toPercent(defaultSize)}
    minSize={toPercent(minSize)}
    maxSize={toPercent(maxSize)}
    collapsedSize={toPercent(collapsedSize)}
    {...rest}
  />
);

interface ResizableHandleProps
  extends React.ComponentPropsWithRef<typeof ResizablePrimitive.Separator> {
  withHandle?: boolean;
}

const ResizableHandle: React.FC<ResizableHandleProps> = ({
  withHandle,
  className,
  ...props
}) => (
  <ResizablePrimitive.Separator
    className={cn(
      'bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-none aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90',
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-sm border">
        <DragHandleDots2Icon className="h-2.5 w-2.5" />
      </div>
    )}
  </ResizablePrimitive.Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
