import * as React from 'react';
import { isOrderedList } from '@kit/plate/list';
import type { RenderStaticNodeWrapper, TListElement } from '@kit/plate';
import type { SlateRenderElementProps } from '@kit/plate/static';

/**
 * Email-safe list wrapper. Ordered variants serialize inside a real <ol>;
 * todo items become ☑/☐ glyph spans (form controls do not work in email
 * clients) with inline-styled strike-through on completed items. Classes are
 * stripped by the serializer, so styling is inline-only.
 */
const TODO_GLYPH_STYLE: React.CSSProperties = {
  display: 'inline-block',
  fontFamily:
    "'Segoe UI Symbol', 'Apple Color Emoji', 'Noto Sans Symbols', sans-serif",
  marginRight: '6px',
};

export const BlockListStatic: RenderStaticNodeWrapper = (props) => {
  if (!props.element.listStyleType) return;
  if (!isOrderedList(props.element)) return;

  return (p) => <ListStatic {...p} />;
};

function ListStatic(props: SlateRenderElementProps) {
  const { listStart, listStyleType } = props.element as TListElement;
  const isTodo = listStyleType === 'todo';
  const ListTag = isOrderedList(props.element) ? 'ol' : 'ul';

  return (
    <ListTag
      start={listStart}
      style={{
        listStyleType: isTodo ? 'none' : listStyleType,
        margin: 0,
        padding: 0,
      }}
    >
      {isTodo ? <TodoLiStatic {...props} /> : <li>{props.children}</li>}
    </ListTag>
  );
}

function TodoLiStatic(props: SlateRenderElementProps) {
  const checked = Boolean(props.element.checked);

  return (
    <li
      style={{
        listStyleType: 'none',
        ...(checked
          ? { color: '#6b7280', textDecoration: 'line-through' }
          : {}),
      }}
    >
      <span aria-hidden="true" style={TODO_GLYPH_STYLE}>
        {checked ? '☑' : '☐'}
      </span>
      {props.children}
    </li>
  );
}
