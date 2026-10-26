'use client';

import { DndPlugin } from '@kit/plate/dnd';
import type { PlateEditor } from '@kit/plate/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import { BlockDraggable } from './block-draggable';

/**
 * The node itself or its closest ancestor that actually scrolls. The composer
 * scrolls its payload pane, not the window, so the drag scroller has to move
 * that pane. Undefined means the window.
 */
export function nearestScrollParent(node: Element | null | undefined) {
  for (let el = node ?? null; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight
    ) {
      return el;
    }
  }
  return undefined;
}

/**
 * A ref whose `current` is the editor's scroll pane, looked up each time the
 * drag scroller asks, so it finds whichever pane hosts this editor: composer,
 * signature, template or auto-reply. A class on purpose: Plate's option store
 * walks into plain objects, so a getter on one ran on every editor change
 * (and hung the editor in tests) instead of only when the scroller asks.
 */
class ScrollParentRef {
  constructor(private readonly editor: PlateEditor) {}

  get current() {
    const root = this.editor.api.toDOMNode(this.editor);
    return root ? (nearestScrollParent(root) ?? null) : null;
  }
}

/**
 * Drag-and-drop block reordering. The react-dnd provider is mounted via
 * `render.aboveSlate` (inside <Plate>, around the editable) and the per-block
 * drag handle via `render.aboveNodes`, no change to the editor shell needed.
 * Purely interactive chrome; no email-serialization impact.
 */
export const DndKit = [
  DndPlugin.configure(({ editor }) => ({
    options: {
      enableScroller: true,
      scrollerProps: { containerRef: new ScrollParentRef(editor as PlateEditor) },
    },
    render: {
      aboveNodes: BlockDraggable,
      aboveSlate: ({ children }) => (
        <DndProvider backend={HTML5Backend}>{children}</DndProvider>
      ),
    },
  })),
];
