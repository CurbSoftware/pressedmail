'use client';

import type React from 'react';
import { type TElement } from '@kit/plate';
import { PlateElement } from '@kit/plate/react';

import { cn } from '@/lib/utils';

export interface AISuggestionElement extends TElement {
  type: 'ai-suggestion';
  accepted?: boolean | null;
  suggestionId?: string;
}

export function AISuggestionNode({
  attributes,
  children,
  className,
  element,
  ...props
}: React.ComponentProps<typeof PlateElement>) {
  const ai = element as AISuggestionElement;
  const isAccepted = ai.accepted === true;
  const isRejected = ai.accepted === false;

  return (
    <PlateElement
      attributes={attributes}
      className={cn(
        'pm-ai-suggestion inline rounded-sm px-0.5',
        isAccepted && 'bg-success/10 text-success',
        isRejected && 'bg-destructive/10 text-destructive line-through',
        !isAccepted && !isRejected && 'bg-primary/10 text-primary',
        className,
      )}
      element={element}
      {...props}
    >
      {children}
    </PlateElement>
  );
}
