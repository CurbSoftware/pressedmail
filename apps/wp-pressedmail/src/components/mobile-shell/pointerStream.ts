"use client";

/** Ignore touch pointer events, including cancel; the touch stream owns those gestures. */
export function isNonTouchPointer(event: { pointerType?: string }): boolean {
  return event.pointerType !== "touch";
}
