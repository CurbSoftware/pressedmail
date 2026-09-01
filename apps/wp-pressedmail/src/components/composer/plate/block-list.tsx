'use client';

import type * as React from 'react';
import { isOrderedList } from '@kit/plate/list';
import {
  useTodoListElement,
  useTodoListElementState,
} from '@kit/plate/list/react';
import type { TListElement } from '@kit/plate';
import {
  type PlateElementProps,
  type RenderNodeWrapper,
  useReadOnly,
} from '@kit/plate/react';

import { Checkbox } from '@kit/ui/plugin';

import { cn } from '@/lib/utils';

/**
 * List wrapper (template block-list.tsx port). Ordered variants render inside
 * a real <ol>; the `todo` variant adds an interactive checkbox marker.
 * Unordered items get display:list-item via the ListPlugin inject rule.
 * Email serialization uses block-list-static.tsx (glyphs, no form controls).
 */
const config: Record<
  string,
  {
    Li: React.FC<PlateElementProps>;
    Marker: React.FC<PlateElementProps>;
  }
> = {
  todo: {
    Li: TodoLi,
    Marker: TodoMarker,
  },
};

export const BlockList: RenderNodeWrapper = (props) => {
  if (!props.element.listStyleType) return;
  if (!isOrderedList(props.element)) return;

  return (p) => <List {...p} />;
};

function List(props: PlateElementProps) {
  const { listStart, listStyleType } = props.element as TListElement;
  const { Li, Marker } = config[listStyleType ?? ''] ?? {};
  const ListTag = isOrderedList(props.element) ? 'ol' : 'ul';

  return (
    <ListTag
      className="relative m-0 p-0"
      start={listStart}
      style={{ listStyleType }}
    >
      {Marker && <Marker {...props} />}
      {Li ? <Li {...props} /> : <li>{props.children}</li>}
    </ListTag>
  );
}

function TodoMarker(props: PlateElementProps) {
  const state = useTodoListElementState({ element: props.element });
  const { checkboxProps } = useTodoListElement(state);
  const readOnly = useReadOnly();

  return (
    <div contentEditable={false}>
      <Checkbox
        className={cn(
          'absolute -left-6 top-1',
          readOnly && 'pointer-events-none',
        )}
        {...checkboxProps}
      />
    </div>
  );
}

function TodoLi(props: PlateElementProps) {
  return (
    <li
      className={cn(
        'list-none',
        (props.element.checked as boolean) &&
          'text-muted-foreground line-through',
      )}
    >
      {props.children}
    </li>
  );
}
