'use client';

import * as React from 'react';
import type { TMentionElement } from '@kit/plate';
import type { PlateElementProps } from '@kit/plate/react';
import {
  PlateElement,
  useFocused,
  useReadOnly,
  useSelected,
} from '@kit/plate/react';

import { cn } from '@/lib/utils';

/** Committed mention chip. Email serialization renders plain `@name` text. */
export function MentionElement(
  props: PlateElementProps<TMentionElement> & { prefix?: string },
) {
  const { element } = props;
  const selected = useSelected();
  const focused = useFocused();
  const readOnly = useReadOnly();

  return (
    <PlateElement
      {...props}
      attributes={{
        ...props.attributes,
        contentEditable: false,
        'data-slate-value': element.value,
        draggable: true,
      }}
      className={cn(
        'inline-block rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm font-medium',
        !readOnly && 'cursor-pointer',
        selected && focused && 'ring-2 ring-ring',
      )}
    >
      {props.prefix}
      {element.value}
      {props.children}
    </PlateElement>
  );
}
