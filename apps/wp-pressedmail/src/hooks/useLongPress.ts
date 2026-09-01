"use client";

import * as React from "react";

export interface UseLongPressOptions {
  onLongPress: (event: React.PointerEvent | PointerEvent) => void;
  /** Hold duration in ms before firing. */
  delay?: number;
  /** Pointer movement budget before cancelling, in CSS pixels. */
  slop?: number;
  disabled?: boolean;
}

export interface LongPressHandlers {
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerCancel: (event: React.PointerEvent) => void;
  onPointerLeave: (event: React.PointerEvent) => void;
}

/**
 * Press-and-hold detector. Fires `onLongPress` after `delay` ms unless the
 * pointer is released or moved beyond `slop` pixels first. Returns pointer
 * event handlers that can be spread onto any element.
 */
export function useLongPress({
  onLongPress,
  delay = 500,
  slop = 12,
  disabled = false,
}: UseLongPressOptions): LongPressHandlers {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = React.useRef<{ x: number; y: number } | null>(null);
  const handlerRef = React.useRef(onLongPress);

  React.useEffect(() => {
    handlerRef.current = onLongPress;
  }, [onLongPress]);

  const cancel = React.useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    start.current = null;
  }, []);

  React.useEffect(() => () => cancel(), [cancel]);

  return React.useMemo<LongPressHandlers>(
    () => ({
      onPointerDown: (event) => {
        if (disabled) return;
        cancel();
        start.current = { x: event.clientX, y: event.clientY };
        timer.current = setTimeout(() => {
          timer.current = null;
          handlerRef.current(event);
        }, delay);
      },
      onPointerUp: () => cancel(),
      onPointerLeave: () => cancel(),
      onPointerCancel: () => cancel(),
      onPointerMove: (event) => {
        if (!start.current) return;
        const dx = event.clientX - start.current.x;
        const dy = event.clientY - start.current.y;
        if (Math.hypot(dx, dy) > slop) cancel();
      },
    }),
    [cancel, delay, disabled, slop],
  );
}
