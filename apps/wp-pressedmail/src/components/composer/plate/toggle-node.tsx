'use client';

import { useToggleButton, useToggleButtonState } from '@kit/plate/toggle/react';
import { ChevronRight } from 'lucide-react';
import type { PlateElementProps } from '@kit/plate/react';
import { PlateElement } from '@kit/plate/react';

import { Button } from '@kit/ui/plugin';

import { cn } from '@/lib/utils';

/**
 * Interactive collapsible toggle. Children with a higher indent collapse under
 * this summary line. Email serialization renders it expanded (toggle-node-static).
 */
export function ToggleElement(props: PlateElementProps) {
  const element = props.element;
  const state = useToggleButtonState(element.id as string);
  const { buttonProps, open } = useToggleButton(state);

  return (
    <PlateElement {...props} className="pl-6">
      <Button
        className="absolute top-0 -left-0.5 size-6 cursor-pointer select-none items-center justify-center rounded-md p-px text-muted-foreground transition-colors hover:bg-accent [&_svg]:size-4"
        contentEditable={false}
        size="icon"
        variant="ghost"
        {...buttonProps}
      >
        <ChevronRight
          className={cn(
            'transition-transform duration-75',
            open ? 'rotate-90' : 'rotate-0',
          )}
        />
      </Button>
      {props.children}
    </PlateElement>
  );
}
