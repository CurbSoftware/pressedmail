'use client';

import { cva } from 'class-variance-authority';
import { useBlockSelected } from '@kit/plate/selection/react';
import type { PlateElementProps } from '@kit/plate/react';

import { cn } from '@/lib/utils';

/**
 * Selection overlay class. Exported so table cell/row overlays can reuse the
 * same look as the block-selection overlay (vendored from the playground).
 */
export const blockSelectionVariants = cva(
  'pointer-events-none absolute inset-0 z-[1] rounded-sm bg-primary/15 transition-opacity',
  {
    defaultVariants: {
      active: true,
    },
    variants: {
      active: {
        false: 'opacity-0',
      },
    },
  },
);

/**
 * Semi-transparent overlay shown over block-selected nodes. Rendered via
 * BlockSelectionPlugin render.belowRootNodes for selectable blocks.
 */
export function BlockSelection(props: PlateElementProps) {
  const isBlockSelected = useBlockSelected();

  if (
    !isBlockSelected ||
    props.plugin.key === 'tr' ||
    props.plugin.key === 'table'
  ) {
    return null;
  }

  return (
    <div
      data-slot="block-selection"
      className={cn(blockSelectionVariants())}
    />
  );
}
