import { useCallback, useEffect, useRef, useState } from "react";

export interface OverflowScrollState {
  canScrollNext: boolean;
  canScrollPrevious: boolean;
  isRtl: boolean;
}

export interface OverflowScroll<
  T extends HTMLElement,
> extends OverflowScrollState {
  ref: React.RefCallback<T>;
  scrollNext: () => void;
  scrollPrevious: () => void;
  update: () => void;
}

export type RtlScrollType = "default" | "negative" | "reverse";
type ScrollDirection = "ltr" | "rtl";

let detectedRtlScrollType: RtlScrollType | null = null;

function clampOffset(offset: number, maxOffset: number) {
  return Math.min(maxOffset, Math.max(0, offset));
}

export function getLogicalScrollOffset(
  rawOffset: number,
  maxOffset: number,
  direction: ScrollDirection,
  rtlType: RtlScrollType,
) {
  if (direction === "ltr") return clampOffset(rawOffset, maxOffset);
  if (rtlType === "negative") {
    return clampOffset(-rawOffset, maxOffset);
  }
  if (rtlType === "default") {
    return clampOffset(maxOffset - rawOffset, maxOffset);
  }
  return clampOffset(rawOffset, maxOffset);
}

export function getRawScrollOffset(
  logicalOffset: number,
  maxOffset: number,
  direction: ScrollDirection,
  rtlType: RtlScrollType,
) {
  const offset = clampOffset(logicalOffset, maxOffset);
  if (direction === "ltr") return offset;
  if (rtlType === "negative") return -offset;
  if (rtlType === "default") return maxOffset - offset;
  return offset;
}

function detectRtlScrollType(): RtlScrollType {
  if (detectedRtlScrollType) return detectedRtlScrollType;
  if (typeof document === "undefined" || !document.body) return "negative";

  const container = document.createElement("div");
  const content = document.createElement("div");
  container.dir = "rtl";
  container.style.cssText =
    "position:absolute;left:-9999px;width:4px;height:1px;overflow:scroll";
  content.style.width = "8px";
  content.style.height = "1px";
  container.appendChild(content);
  document.body.appendChild(container);

  if (container.scrollLeft > 0) {
    detectedRtlScrollType = "default";
  } else {
    container.scrollLeft = 1;
    detectedRtlScrollType = container.scrollLeft === 0 ? "negative" : "reverse";
  }
  container.remove();
  return detectedRtlScrollType;
}

function getScrollDirection(element: HTMLElement): ScrollDirection {
  return getComputedStyle(element).direction === "rtl" ? "rtl" : "ltr";
}

/**
 * Tracks horizontal overflow on a scroll container and exposes paging helpers.
 *
 * jsdom has no layout engine, so the consumer drives scrollWidth/clientWidth/
 * scrollLeft in tests and calls update() (or dispatches a scroll event).
 */
export function useOverflowScroll<
  T extends HTMLElement = HTMLElement,
>(): OverflowScroll<T> {
  const elementRef = useRef<T | null>(null);
  const [state, setState] = useState<OverflowScrollState>({
    canScrollNext: false,
    canScrollPrevious: false,
    isRtl: false,
  });

  const update = useCallback(() => {
    const el = elementRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxOffset = Math.max(0, scrollWidth - clientWidth);
    const direction = getScrollDirection(el);
    const rtlType = direction === "rtl" ? detectRtlScrollType() : "reverse";
    const logicalOffset = getLogicalScrollOffset(
      scrollLeft,
      maxOffset,
      direction,
      rtlType,
    );
    setState((prev) => {
      const next = {
        canScrollNext: logicalOffset < maxOffset - 1,
        canScrollPrevious: logicalOffset > 1,
        isRtl: direction === "rtl",
      };
      if (
        prev.canScrollNext === next.canScrollNext &&
        prev.canScrollPrevious === next.canScrollPrevious &&
        prev.isRtl === next.isRtl
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const scrollByDirection = useCallback((logicalDirection: 1 | -1) => {
    const el = elementRef.current;
    if (!el || typeof el.scrollBy !== "function") return;
    const maxOffset = Math.max(0, el.scrollWidth - el.clientWidth);
    const direction = getScrollDirection(el);
    const rtlType = direction === "rtl" ? detectRtlScrollType() : "reverse";
    const logicalOffset = getLogicalScrollOffset(
      el.scrollLeft,
      maxOffset,
      direction,
      rtlType,
    );
    const amount = Math.max(120, el.clientWidth * 0.7);
    const targetOffset = clampOffset(
      logicalOffset + logicalDirection * amount,
      maxOffset,
    );
    const rawTarget = getRawScrollOffset(
      targetOffset,
      maxOffset,
      direction,
      rtlType,
    );
    el.scrollBy({ left: rawTarget - el.scrollLeft, behavior: "smooth" });
  }, []);

  const scrollPrevious = useCallback(
    () => scrollByDirection(-1),
    [scrollByDirection],
  );
  const scrollNext = useCallback(
    () => scrollByDirection(1),
    [scrollByDirection],
  );

  const ref = useCallback<React.RefCallback<T>>(
    (node) => {
      const previous = elementRef.current;
      if (previous) {
        previous.removeEventListener("scroll", update);
      }
      elementRef.current = node;
      if (node) {
        node.addEventListener("scroll", update, { passive: true });
        update();
      }
    },
    [update],
  );

  useEffect(() => {
    const el = elementRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => update());
    observer.observe(el);
    return () => observer.disconnect();
  }, [update]);

  return {
    ref,
    canScrollNext: state.canScrollNext,
    canScrollPrevious: state.canScrollPrevious,
    isRtl: state.isRtl,
    scrollNext,
    scrollPrevious,
    update,
  };
}
