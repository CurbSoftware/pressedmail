import { PathApi, type TElement } from '@kit/plate';
import { createPlatePlugin, type PlateEditor } from '@kit/plate/react';

import { insertLine } from './block-move';

/**
 * A block the caret cannot type in: a void, or one of the dialect's read-only
 * blocks (Rich text shows callouts, tables, columns and the like read-only).
 */
function isClosed(editor: PlateEditor, node: TElement, readOnlyTypes: string[]) {
  return (
    editor.api.isVoid(node) ||
    (readOnlyTypes.includes(node.type) && !editor.api.isInline(node))
  );
}

/** The closed block the caret is on or in, outermost first, if any. */
function caretClosedBlock(editor: PlateEditor, readOnlyTypes: string[]) {
  if (!editor.selection || editor.api.isExpanded() || editor.dom.readOnly) {
    return;
  }
  if (readOnlyTypes.length) {
    // A table cell sits in a row in a table, all read-only: the line goes
    // next to the table.
    const outer = editor.api.above<TElement>({
      match: (node) => isClosed(editor, node as TElement, readOnlyTypes),
      mode: 'highest',
    });
    if (outer) return outer;
  }
  const entry = editor.api.block<TElement>();
  return entry && editor.api.isVoid(entry[0]) ? entry : undefined;
}

/**
 * A caret on an image (or any other void) has nowhere to type, and an image
 * at the very top of a message used to leave no way above it. This gives
 * every void a way out, in Markdown and Rich text alike, and in Rich text
 * also every block it shows read-only (`readOnlyTypes`, set by the dialect):
 *
 * - Enter adds a line below it, Shift+Enter a line above.
 * - ArrowUp on a void with nothing above it adds a line above, and ArrowDown
 *   with nothing below adds a line below.
 * - A click in the space above a leading void adds a line above it.
 *
 * New lines stay in the block's own column, cell or quote (`insertLine`).
 */
export const VoidLinePlugin = createPlatePlugin({
  key: 'pmVoidLine',
  options: { readOnlyTypes: [] as string[] },
  handlers: {
    onKeyDown: ({ editor, event, getOptions }) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.nativeEvent.isComposing) return;
      const entry = caretClosedBlock(editor, getOptions().readOnlyTypes);
      if (!entry) return;
      const [element, path] = entry;

      let direction: -1 | 1 | undefined;
      if (event.key === 'Enter') direction = event.shiftKey ? -1 : 1;
      else if (event.shiftKey) return;
      else if (event.key === 'ArrowUp' && path[path.length - 1] === 0) {
        direction = -1;
      } else if (
        event.key === 'ArrowDown' &&
        !editor.api.node(PathApi.next(path))
      ) {
        direction = 1;
      }
      if (!direction) return;

      event.preventDefault();
      insertLine(editor, element, direction);
      return true;
    },
    onMouseDown: ({ editor, event, getOptions }) => {
      if (event.button !== 0 || event.target !== event.currentTarget) return;
      if (editor.dom.readOnly) return;
      const first = editor.children[0] as TElement | undefined;
      if (!first || !isClosed(editor, first, getOptions().readOnlyTypes)) return;
      const node = editor.api.toDOMNode(first);
      if (!node || event.clientY >= node.getBoundingClientRect().top) return;

      event.preventDefault();
      insertLine(editor, first, -1);
      return true;
    },
  },
});
