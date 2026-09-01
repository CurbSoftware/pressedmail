'use client';

import { DndPlugin } from '@kit/plate/dnd';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import { BlockDraggable } from './block-draggable';

/**
 * Drag-and-drop block reordering. The react-dnd provider is mounted via
 * `render.aboveSlate` (inside <Plate>, around the editable) and the per-block
 * drag handle via `render.aboveNodes`, no change to the editor shell needed.
 * Purely interactive chrome; no email-serialization impact.
 */
export const DndKit = [
  DndPlugin.configure({
    options: { enableScroller: true },
    render: {
      aboveNodes: BlockDraggable,
      aboveSlate: ({ children }) => (
        <DndProvider backend={HTML5Backend}>{children}</DndProvider>
      ),
    },
  }),
];
