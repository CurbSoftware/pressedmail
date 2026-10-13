import { useCallback, useState } from "react";

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Zoom buttons and keys walk these. 1 is 100%, one image pixel per screen pixel. */
export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8] as const;
export const MAX_ZOOM = 8;

const EPSILON = 0.001;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/**
 * The scale at which the whole image fits. A small image is not blown up to
 * fill the stage, so this never goes above 1. Sizes that are not known yet
 * (before layout, before the image loads) leave the image at its own size.
 */
export function fitScale(image: Size, viewport: Size): number {
  if (
    image.width <= 0 ||
    image.height <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return 1;
  }
  return Math.min(
    1,
    viewport.width / image.width,
    viewport.height / image.height,
  );
}

/** The next zoom step above or below `scale`, never below `floor` or above MAX_ZOOM. */
export function stepZoom(
  scale: number,
  direction: 1 | -1,
  floor: number,
): number {
  if (direction > 0) {
    return ZOOM_STEPS.find((step) => step > scale + EPSILON) ?? MAX_ZOOM;
  }
  const below = [...ZOOM_STEPS]
    .reverse()
    .find((step) => step < scale - EPSILON);
  return Math.max(floor, below ?? floor);
}

/**
 * Keep a panned image from leaving the stage. An axis where the image is
 * smaller than the stage stays centred.
 */
export function clampOffset(
  offset: Point,
  scale: number,
  image: Size,
  viewport: Size,
): Point {
  const slackX = Math.max(0, (image.width * scale - viewport.width) / 2);
  const slackY = Math.max(0, (image.height * scale - viewport.height) / 2);
  return {
    x: clamp(offset.x, -slackX, slackX),
    y: clamp(offset.y, -slackY, slackY),
  };
}

/**
 * The offset that keeps the image point under `focal` (measured from the
 * stage centre) where it is while the scale changes. Zooming by a button
 * passes no focal point and so zooms about the centre.
 */
export function offsetAfterZoom(
  offset: Point,
  from: number,
  to: number,
  focal: Point,
): Point {
  const ratio = to / from;
  return {
    x: focal.x - (focal.x - offset.x) * ratio,
    y: focal.y - (focal.y - offset.y) * ratio,
  };
}

interface ViewState {
  /** null follows the fit scale as the stage resizes. */
  scale: number | null;
  offset: Point;
}

const ORIGIN: Point = { x: 0, y: 0 };

/**
 * Zoom and pan for one image. Everything is expressed against the image's own
 * pixels, so "100%" really is one image pixel per screen pixel.
 */
export function useImageViewport() {
  const [image, setImage] = useState<Size>({ width: 0, height: 0 });
  const [stage, setStage] = useState<Size>({ width: 0, height: 0 });
  const [view, setView] = useState<ViewState>({ scale: null, offset: ORIGIN });

  const fit = fitScale(image, stage);
  const scale = view.scale ?? fit;
  const offset = clampOffset(view.offset, scale, image, stage);
  const isFit = view.scale === null || Math.abs(scale - fit) < EPSILON;

  /** Forget the picture: its size, and any zoom or pan. */
  const reset = useCallback(() => {
    setImage({ width: 0, height: 0 });
    setView({ scale: null, offset: ORIGIN });
  }, []);

  /** Move to a scale, about a point. Reaching the fit scale hands control back to the stage. */
  const zoomTo = (target: number, focal: Point = ORIGIN) =>
    setView((current) => {
      const from = current.scale ?? fit;
      const next = clamp(target, fit, MAX_ZOOM);
      if (Math.abs(next - fit) < EPSILON)
        return { scale: null, offset: ORIGIN };
      return {
        scale: next,
        offset: clampOffset(
          offsetAfterZoom(current.offset, from, next, focal),
          next,
          image,
          stage,
        ),
      };
    });

  return {
    scale,
    offset,
    fit,
    isFit,
    percent: Math.round(scale * 100),
    image,
    /** A new picture arrived: remember its size and start from the fit. */
    loadImage: (size: Size) => {
      setImage(size);
      setView({ scale: null, offset: ORIGIN });
    },
    setStage,
    reset,
    zoomTo,
    zoomIn: (focal?: Point) => zoomTo(stepZoom(scale, 1, fit), focal),
    zoomOut: (focal?: Point) => zoomTo(stepZoom(scale, -1, fit), focal),
    fitToStage: () => setView({ scale: null, offset: ORIGIN }),
    actualSize: () => zoomTo(1),
    /** Double click or double tap: in and out between fit and a closer look. */
    toggleZoom: (focal?: Point) =>
      isFit ? zoomTo(fit < 1 ? 1 : 2, focal) : zoomTo(fit),
    panBy: (dx: number, dy: number) =>
      setView((current) => ({
        scale: current.scale,
        offset: clampOffset(
          { x: current.offset.x + dx, y: current.offset.y + dy },
          current.scale ?? fit,
          image,
          stage,
        ),
      })),
  };
}

export type ImageViewport = ReturnType<typeof useImageViewport>;
