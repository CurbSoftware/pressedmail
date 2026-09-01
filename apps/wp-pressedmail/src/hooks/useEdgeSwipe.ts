"use client";

import * as React from "react";

export interface UseEdgeSwipeOptions {
  /** Which edge of the viewport starts the gesture. */
  edge: "left" | "right";
  /** Width of the touch-active edge zone in CSS pixels. */
  edgeSize?: number;
  /** Horizontal distance the pointer must travel to trigger onComplete. */
  threshold?: number;
  /** Disables detection entirely. */
  disabled?: boolean;
  onComplete: () => void;
}

export interface EdgeSwipeHandlers {
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
  onPointerCancel: (event: React.PointerEvent) => void;
}

interface GestureState {
  active: boolean;
  startX: number;
  startY: number;
  lastX: number;
  cancelled: boolean;
}

const INITIAL: GestureState = {
  active: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  cancelled: false,
};

/**
 * Edge-swipe gesture detector. Fires `onComplete()` when the pointer is
 * pressed inside an edge zone (left or right side of the viewport) and
 * dragged horizontally past `threshold` pixels before release. Cancels if
 * the vertical drift dominates (treated as a scroll).
 */
export function useEdgeSwipe({
  edge,
  edgeSize = 24,
  threshold = 80,
  disabled = false,
  onComplete,
}: UseEdgeSwipeOptions): EdgeSwipeHandlers {
  const state = React.useRef<GestureState>({ ...INITIAL });
  const onCompleteRef = React.useRef(onComplete);

  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  return React.useMemo<EdgeSwipeHandlers>(() => {
    function start(event: React.PointerEvent) {
      if (disabled) return;
      const viewportWidth =
        typeof window !== "undefined" ? window.innerWidth : 0;
      const x = event.clientX;
      const inEdge =
        edge === "left" ? x <= edgeSize : x >= viewportWidth - edgeSize;
      if (!inEdge) {
        state.current = { ...INITIAL };
        return;
      }
      state.current = {
        active: true,
        startX: x,
        startY: event.clientY,
        lastX: x,
        cancelled: false,
      };
    }

    function move(event: React.PointerEvent) {
      const s = state.current;
      if (!s.active || s.cancelled) return;
      const dx = event.clientX - s.startX;
      const dy = event.clientY - s.startY;
      if (Math.abs(dy) > Math.max(24, Math.abs(dx))) {
        s.cancelled = true;
        return;
      }
      s.lastX = event.clientX;
    }

    function end(event: React.PointerEvent) {
      const s = state.current;
      if (!s.active || s.cancelled) {
        state.current = { ...INITIAL };
        return;
      }
      const finalX = event.clientX || s.lastX;
      const dx = finalX - s.startX;
      const passed = edge === "left" ? dx >= threshold : dx <= -threshold;
      state.current = { ...INITIAL };
      if (passed) onCompleteRef.current();
    }

    return {
      onPointerDown: start,
      onPointerMove: move,
      onPointerUp: end,
      onPointerCancel: () => {
        state.current = { ...INITIAL };
      },
    };
  }, [edge, edgeSize, threshold, disabled]);
}
