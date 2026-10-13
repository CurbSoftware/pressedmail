import * as React from "react";

import { cn } from "@/lib/utils";

import type { ImageViewport, Point } from "./image-viewport";

/** Keyboard pan, in screen pixels per press. */
const PAN_STEP = 80;

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

interface ImageViewProps {
  url: string;
  /** The file name. An image with no text of its own is described by it. */
  alt: string;
  /** Names the stage for assistive technology. */
  label: string;
  viewport: ImageViewport;
  /** The bytes arrived but the browser could not draw them. */
  onBroken: () => void;
}

/**
 * One image, fitted to its stage. Zoom and pan come from the viewport the
 * dialog owns, so its buttons and keys drive the same state as a wheel, a
 * double click or a pinch here.
 */
export function ImageView({
  url,
  alt,
  label,
  viewport,
  onBroken,
}: ImageViewProps) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const pointers = React.useRef(new Map<number, Point>());
  const pinch = React.useRef<{ distance: number; scale: number } | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const { setStage, reset } = viewport;

  // When this picture goes (the next attachment, a retry, a close), so does its size and zoom.
  React.useEffect(() => reset, [reset]);

  // The stage is whatever room the dialog leaves, so measure it, and again when it resizes.
  React.useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () =>
      setStage({ width: stage.clientWidth, height: stage.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [setStage]);

  /** A screen point as an offset from the stage centre, which is where zoom is anchored. */
  const focalOf = (clientX: number, clientY: number): Point => {
    const box = stageRef.current?.getBoundingClientRect();
    return box
      ? {
          x: clientX - box.left - box.width / 2,
          y: clientY - box.top - box.height / 2,
        }
      : { x: 0, y: 0 };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      pinch.current = { distance: distance(a, b), scale: viewport.scale };
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const before = pointers.current.get(event.pointerId);
    if (!before) return;
    const now = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, now);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      const gap = distance(a, b);
      if (pinch.current.distance > 0 && gap > 0) {
        viewport.zoomTo(
          pinch.current.scale * (gap / pinch.current.distance),
          focalOf((a.x + b.x) / 2, (a.y + b.y) / 2),
        );
      }
    } else if (pointers.current.size === 1 && !viewport.isFit) {
      viewport.panBy(now.x - before.x, now.y - before.y);
    }
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Zoomed in, the arrows move the picture. At the fit they belong to the
    // dialog, which uses them to step between attachments.
    if (viewport.isFit || event.ctrlKey || event.metaKey || event.altKey)
      return;
    const move: Record<string, [number, number]> = {
      ArrowLeft: [PAN_STEP, 0],
      ArrowRight: [-PAN_STEP, 0],
      ArrowUp: [0, PAN_STEP],
      ArrowDown: [0, -PAN_STEP],
    };
    const step = move[event.key];
    if (!step) return;
    event.preventDefault();
    event.stopPropagation();
    viewport.panBy(step[0], step[1]);
  };

  const { image, scale, offset } = viewport;
  return (
    <div
      ref={stageRef}
      role="group"
      aria-label={label}
      tabIndex={0}
      data-pm-preview-stage=""
      className={cn(
        "relative h-full w-full touch-none overflow-hidden outline-none select-none",
        !viewport.isFit && "cursor-grab active:cursor-grabbing",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onWheel={(event) =>
        viewport.zoomTo(
          viewport.scale *
            Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.002)),
          focalOf(event.clientX, event.clientY),
        )
      }
      onDoubleClick={(event) =>
        viewport.toggleZoom(focalOf(event.clientX, event.clientY))
      }
      onKeyDown={onKeyDown}>
      <img
        src={url}
        alt={alt}
        draggable={false}
        onLoad={(event) => {
          viewport.loadImage({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          });
          setLoaded(true);
        }}
        onError={onBroken}
        className="absolute top-1/2 left-1/2 max-w-none"
        style={
          loaded && image.width > 0
            ? {
                width: image.width * scale,
                height: image.height * scale,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
              }
            : { visibility: "hidden" }
        }
      />
    </div>
  );
}
