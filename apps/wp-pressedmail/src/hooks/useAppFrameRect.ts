"use client";

import { useEffect, useState, type CSSProperties } from "react";

export interface AppFrameBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Covers the frame edge to edge, optionally inset by a uniform gutter: the
 * frame-relative equivalent of `inset-0` / `inset-4`.
 */
export function frameCoverStyle(
  box: AppFrameBox | null,
  inset = 0,
): CSSProperties | undefined {
  if (!box) return undefined;
  return {
    top: box.top + inset,
    left: box.left + inset,
    width: Math.max(box.width - inset * 2, 0),
    height: Math.max(box.height - inset * 2, 0),
  };
}

export interface FrameCenterOptions {
  /** Fraction of the frame width to occupy. Omit to keep the caller's width. */
  widthRatio?: number;
  /** Absolute px cap, mirroring a max-w-* class. */
  maxWidth?: number;
  /** Fraction of the frame height to occupy. Omit for auto-height panels. */
  heightRatio?: number;
  /** Floor for heightRatio, mirroring a min-h-* class. */
  minHeight?: number;
  maxHeightRatio?: number;
}

/**
 * Centres a panel inside the frame instead of the viewport. Pairs with the
 * `-translate-x-1/2 -translate-y-1/2` classes the callers already carry; only
 * the dimensions whose ratios are supplied get written, so a caller can keep
 * its own width or auto height.
 */
export function frameCenterStyle(
  box: AppFrameBox | null,
  {
    widthRatio,
    maxWidth,
    heightRatio,
    minHeight,
    maxHeightRatio = 0.92,
  }: FrameCenterOptions = {},
): CSSProperties | undefined {
  if (!box) return undefined;

  const style: CSSProperties = {
    top: box.top + Math.round(box.height / 2),
    left: box.left + Math.round(box.width / 2),
    maxHeight: Math.round(box.height * maxHeightRatio),
  };

  if (widthRatio) {
    style.width = Math.min(
      Math.round(box.width * widthRatio),
      maxWidth ?? Number.POSITIVE_INFINITY,
    );
  }

  if (heightRatio) {
    style.height = Math.min(
      Math.max(
        Math.round(box.height * heightRatio),
        Math.min(minHeight ?? 0, box.height),
      ),
      Math.round(box.height * maxHeightRatio),
    );
  }

  return style;
}

const APP_FRAME_SELECTOR = "[data-pm-app-frame]";

function readBox(element: HTMLElement): AppFrameBox {
  const rect = element.getBoundingClientRect();
  return {
    top: Math.round(rect.top),
    left: Math.round(rect.left),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function sameBox(a: AppFrameBox | null, b: AppFrameBox | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height
  );
}

/**
 * Measures the PressedMail app frame (`[data-pm-app-frame]`, the element
 * ApplicationLayout sizes to the plugin's slice of wp-admin).
 *
 * Overlays that must cover "the whole PressedMail UI" cannot use `inset-0`:
 * that targets the viewport, and WordPress paints #wpadminbar (z-index 99999)
 * and #adminmenuwrap over anything the plugin can reasonably stack. They also
 * cannot simply portal into the frame, moving a live panel between DOM
 * parents remounts it, which would discard an in-progress composer. So they
 * stay where they are, keep `position: fixed` (needed to escape the panes'
 * overflow), and take their coordinates from this box instead.
 *
 * Returns null when no frame exists: the front-end root fallback and jsdom,
 * so callers keep their viewport behaviour in that case.
 */
export function useAppFrameRect(active: boolean): AppFrameBox | null {
  const [box, setBox] = useState<AppFrameBox | null>(null);

  useEffect(() => {
    if (!active || typeof document === "undefined") {
      setBox(null);
      return;
    }

    const element = document.querySelector<HTMLElement>(APP_FRAME_SELECTOR);
    if (!element) {
      setBox(null);
      return;
    }

    const update = () => {
      const next = readBox(element);
      setBox((current) => (sameBox(current, next) ? current : next));
    };
    update();

    // The frame resizes when the admin bar changes height, the window
    // resizes, or immersive mode toggles; it also moves horizontally when the
    // admin menu folds, which changes its width too.
    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    resizeObserver?.observe(element);

    const mutationObserver =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(update)
        : null;
    mutationObserver?.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("scroll", update, { passive: true });

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("scroll", update);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [active]);

  return box;
}
