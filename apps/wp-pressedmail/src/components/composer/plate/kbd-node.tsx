'use client';

import type { PlateLeafProps } from '@kit/plate/react';
import { PlateLeaf } from '@kit/plate/react';

/** Keyboard-key leaf. Theme tokens only (template uses literal shadows). */
export function KbdLeaf(props: PlateLeafProps) {
  return (
    <PlateLeaf
      {...props}
      as="kbd"
      className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-sm shadow-sm"
    >
      {props.children}
    </PlateLeaf>
  );
}
