"use client";

/**
 * Drag-to-position for the speed dial launcher.
 *
 * Pointer events plus `setPointerCapture`, not a drag library. The launcher is a
 * `position: fixed` element with its own grip, so there is no click-versus-drag
 * conflict to solve with an activation constraint, and nothing to reconcile with
 * the app's dnd-kit contexts, which live inside the mail panes.
 *
 * The grip takes arrow keys too, so the launcher can be placed without a
 * pointer. Both ways in end at `commitPoint`, the one writer.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  parseSpeedDialPosition,
  speedDialPositionValue,
} from "@/hooks/useUserPreferences";

interface SpeedDialDragOptions {
  /** Stored position: a legacy corner token or `<x>,<y>` viewport percentages. */
  position: string;
  /** Launcher diameter in px, so a drag cannot push it off screen. */
  diameter: number;
  /** Top of the usable area, i.e. the WordPress admin bar height. */
  topInset: number;
  /** Called once per drop, with the percentage pair to store. */
  onCommit: (position: string) => void;
}

interface Point {
  left: number;
  top: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  origin: Point;
  moved: boolean;
}

function viewport(): { width: number; height: number } {
  if (typeof window === "undefined") {
    return { width: 1024, height: 768 };
  }

  return { width: window.innerWidth, height: window.innerHeight };
}

function clampToViewport(
  left: number,
  top: number,
  diameter: number,
  topInset: number,
): Point {
  const { width, height } = viewport();

  return {
    left: Math.min(Math.max(left, 0), Math.max(0, width - diameter)),
    // `topInset` wins when the viewport is shorter than the launcher plus inset.
    top: Math.min(
      Math.max(top, topInset),
      Math.max(topInset, height - diameter),
    ),
  };
}

/** Arrow keys, as a direction in viewport percentages. */
const KEYBOARD_STEPS: Record<string, Point> = {
  ArrowLeft: { left: -1, top: 0 },
  ArrowRight: { left: 1, top: 0 },
  ArrowUp: { left: 0, top: -1 },
  ArrowDown: { left: 0, top: 1 },
};

/**
 * One arrow press moves the launcher this share of the viewport, so the step
 * covers the same ground on any screen. A held key repeats, which is what walks
 * the dial from one corner to the other.
 */
const KEYBOARD_STEP_PERCENT = 2;

function toPixels(position: string, diameter: number, topInset: number): Point {
  const { x, y } = parseSpeedDialPosition(position);
  const { width, height } = viewport();

  return clampToViewport(
    (x / 100) * width - diameter / 2,
    (y / 100) * height - diameter / 2,
    diameter,
    topInset,
  );
}

export function useSpeedDialDrag({
  position,
  diameter,
  topInset,
  onCommit,
}: SpeedDialDragOptions) {
  const [offset, setOffset] = useState<Point>(() =>
    toPixels(position, diameter, topInset),
  );
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef<DragState | null>(null);

  /**
   * Re-anchor when the stored position or the window changes, so a percentage
   * saved on a wide screen cannot leave the launcher off a narrow one. Skipped
   * mid-drag: a resize must not yank it out from under the pointer.
   */
  useEffect(() => {
    if (drag.current) {
      return;
    }

    const anchor = () => setOffset(toPixels(position, diameter, topInset));
    anchor();
    window.addEventListener("resize", anchor);

    return () => window.removeEventListener("resize", anchor);
  }, [position, diameter, topInset]);

  /**
   * The one writer for where the launcher sits: a point in pixels goes in, the
   * clamped spot is remembered, and its centre is stored as percentages. A drop
   * and an arrow press both end here, so they cannot drift apart.
   */
  const commitPoint = useCallback(
    ({ left, top }: Point) => {
      const next = clampToViewport(left, top, diameter, topInset);
      const { width, height } = viewport();

      setOffset(next);
      onCommit(
        speedDialPositionValue(
          ((next.left + diameter / 2) / width) * 100,
          ((next.top + diameter / 2) / height) * 100,
        ),
      );
    },
    [diameter, onCommit, topInset],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origin: offset,
        moved: false,
      };
      setIsDragging(true);
    },
    [offset],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const state = drag.current;

      if (!state || state.pointerId !== event.pointerId) {
        return;
      }

      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;

      // A click that wobbles is still a click: no move until it clears 2px.
      if (!state.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) {
        return;
      }

      state.moved = true;
      setOffset(
        clampToViewport(
          state.origin.left + dx,
          state.origin.top + dy,
          diameter,
          topInset,
        ),
      );
    },
    [diameter, topInset],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const state = drag.current;

      if (!state || state.pointerId !== event.pointerId) {
        return;
      }

      drag.current = null;
      setIsDragging(false);

      if (!state.moved) {
        return;
      }

      commitPoint({
        left: state.origin.left + (event.clientX - state.startX),
        top: state.origin.top + (event.clientY - state.startY),
      });
    },
    [commitPoint],
  );

  const onPointerCancel = useCallback(() => {
    if (!drag.current) {
      return;
    }

    drag.current = null;
    setIsDragging(false);
    setOffset(toPixels(position, diameter, topInset));
  }, [diameter, position, topInset]);

  /**
   * The way in without a pointer. An arrow press nudges the launcher and stores
   * the spot, exactly as a drop does, so the keyboard is never a lesser path.
   */
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const step = KEYBOARD_STEPS[event.key];

      if (!step) {
        return;
      }

      event.preventDefault();

      const { width, height } = viewport();
      const next = clampToViewport(
        offset.left + (step.left * KEYBOARD_STEP_PERCENT * width) / 100,
        offset.top + (step.top * KEYBOARD_STEP_PERCENT * height) / 100,
        diameter,
        topInset,
      );

      // A key pressed against an edge has nowhere left to go: nothing to store,
      // so holding it there does not write the same spot over and over.
      if (next.left === offset.left && next.top === offset.top) {
        return;
      }

      commitPoint(next);
    },
    [commitPoint, diameter, offset, topInset],
  );

  return {
    offset,
    isDragging,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onKeyDown,
    },
  };
}
