'use client';

import React from 'react';

import {
  type CursorData,
  type CursorOverlayState,
  useCursorOverlay,
} from '@kit/plate/selection/react';
import { RangeApi } from '@kit/plate';

import { cn } from '@/lib/utils';

/**
 * How long the scroll must be quiet before the overlay rects are recomputed. The
 * upstream hook caches rects from viewport coordinates and has no scroll
 * listener, so without this a paste that grows the document leaves stale rects
 * pinned on screen while the content scrolls under them: a full-width,
 * near-zero-height rect reads as a hairline crossing the text (the 1.7.0-beta.2
 * report, Fig. 05).
 */
const SCROLL_SETTLE_MS = 150;

/**
 * Renders selection/caret overlay rects. Useful when the editor loses
 * focus (e.g. while a toolbar popover is open) so the active selection
 * stays visible. Stripped of the playground's AI-streaming and
 * table-grid coupling, not needed for the email composer.
 */
export function CursorOverlay() {
  const { cursors, refresh } = useCursorOverlay();
  const [hiddenByScroll, setHiddenByScroll] = React.useState(false);

  React.useEffect(() => {
    // Any scroll under the window (the composer pane scrolls an ancestor, and
    // the overlay has no scroll container of its own). While it moves the rects
    // would lag one frame behind; when it settles they are recomputed from the
    // new geometry instead of staying where the old viewport boundary was.
    let settle = 0;
    const finalize = () => {
      settle = 0;
      setHiddenByScroll(false);
      refresh();
    };
    const onScroll = () => {
      setHiddenByScroll(true);
      if (settle) clearTimeout(settle);
      settle = window.setTimeout(finalize, SCROLL_SETTLE_MS);
    };
    // Browsers that say when scrolling ended do not need the settle guess.
    const onScrollEnd = () => {
      if (settle) clearTimeout(settle);
      finalize();
    };
    const options: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener('scroll', onScroll, options);
    window.addEventListener('scrollend', onScrollEnd, options);
    return () => {
      window.removeEventListener('scroll', onScroll, options);
      window.removeEventListener('scrollend', onScrollEnd, options);
      if (settle) clearTimeout(settle);
    };
  }, [refresh]);

  if (hiddenByScroll) return null;

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
