'use client';

import {
  type CursorData,
  type CursorOverlayState,
  useCursorOverlay,
} from '@kit/plate/selection/react';
import { RangeApi } from '@kit/plate';

import { cn } from '@/lib/utils';

/**
 * Renders selection/caret overlay rects. Useful when the editor loses
 * focus (e.g. while a toolbar popover is open) so the active selection
 * stays visible. Stripped of the playground's AI-streaming and
 * table-grid coupling, not needed for the email composer.
 */
export function CursorOverlay() {
  const { cursors } = useCursorOverlay();

  return (
    <>
      {cursors.map((cursor) => (
        <Cursor key={cursor.id} {...cursor} />
      ))}
    </>
  );
}

function Cursor({
  id,
  caretPosition,
  data,
  selection,
  selectionRects,
}: CursorOverlayState<CursorData>) {
  const { style, selectionStyle = style } = data ?? ({} as CursorData);
  const isCursor = selection ? RangeApi.isCollapsed(selection) : false;

  return (
    <>
      {selectionRects.map((position, i) => (
        <div
          key={i}
          className={cn(
            'pointer-events-none absolute z-10',
            id === 'selection' && 'bg-primary/25',
            id === 'selection' && isCursor && 'bg-primary',
          )}
          style={{ ...selectionStyle, ...position }}
        />
      ))}
      {caretPosition && (
        <div
          className={cn(
            'pointer-events-none absolute z-10 w-0.5',
            id === 'drag' && 'w-px bg-primary',
          )}
          style={{ ...caretPosition, ...style }}
        />
      )}
    </>
  );
}
