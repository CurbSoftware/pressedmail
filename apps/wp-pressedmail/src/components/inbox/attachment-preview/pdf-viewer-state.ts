import { useCallback, useMemo, useRef, useState } from "react";

import type { PdfSandbox, PdfSandboxEvent } from "./pdf-sandbox/pdf-sandbox";
import type { PdfForwardedKey } from "./pdf-sandbox/protocol";

/** Zoom buttons and keys walk these. 1 is a page the width of the frame, which is also where it opens. */
export const PDF_ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

const EPSILON = 0.001;

export interface PdfViewerState {
  /** The first page is on screen, or has said why it cannot be. */
  ready: boolean;
  /** Pages in the file. */
  total: number;
  /** Pages the viewer shows. It stops at 200, however long the file is. */
  count: number;
  /** The page the toolbar names, from 1. */
  page: number;
  /** 1 is fit width. */
  zoom: number;
  /** A cMap or a wasm file was missing, so some text or scans may be blank. */
  incomplete: boolean;
}

const INITIAL: PdfViewerState = {
  ready: false,
  total: 0,
  count: 0,
  page: 1,
  zoom: 1,
  incomplete: false,
};

/** The next zoom step above or below `zoom`, or the end of the range. */
export function stepPdfZoom(zoom: number, direction: 1 | -1): number {
  if (direction > 0) {
    return (
      PDF_ZOOM_STEPS.find((step) => step > zoom + EPSILON) ??
      PDF_ZOOM_STEPS[PDF_ZOOM_STEPS.length - 1]!
    );
  }
  const below = [...PDF_ZOOM_STEPS]
    .reverse()
    .find((step) => step < zoom - EPSILON);
  return below ?? PDF_ZOOM_STEPS[0];
}

/** The part of the viewer the dialog's toolbar and keys drive. */
export interface PdfViewer {
  state: PdfViewerState;
  /** The view hands over its sandbox when it starts, and null when it ends. That also resets the state. */
  attach: (sandbox: PdfSandbox | null) => void;
  /** The view reports what the sandbox said. */
  report: (event: PdfSandboxEvent) => void;
  goTo: (page: number) => void;
  step: (direction: -1 | 1) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitWidth: () => void;
  /** Runs a key the frame passed on, or the dialog saw. False for a key that is not a viewer command. */
  pressKey: (key: PdfForwardedKey) => boolean;
}

/**
 * The state behind the PDF toolbar: which page, how far zoomed, whether anything is on screen yet. It lives with the
 * dialog, not the view, the way the image viewport does, so the toolbar buttons and the keys drive one thing.
 */
export function usePdfViewer(): PdfViewer {
  const [state, setState] = useState<PdfViewerState>(INITIAL);
  const sandbox = useRef<PdfSandbox | null>(null);
  // The handlers below are called from event callbacks that outlive a render, so they read the latest state here.
  const latest = useRef(state);
  latest.current = state;

  const attach = useCallback((next: PdfSandbox | null) => {
    sandbox.current = next;
    if (!next) {
      latest.current = INITIAL;
      setState(INITIAL);
    }
  }, []);

  const report = useCallback((event: PdfSandboxEvent) => {
    switch (event.t) {
      case "loaded":
        setState((current) => ({
          ...current,
          total: event.numPages,
          count: event.count,
        }));
        break;
      case "page":
      case "page-error":
        setState((current) =>
          current.ready ? current : { ...current, ready: true },
        );
        break;
      case "visible":
        setState((current) => ({ ...current, page: event.n }));
        break;
      case "asset-missing":
        // A standard font that is not shipped falls back to a system font and looks the same. A cMap or a wasm decoder
        // that is missing leaves text or a whole scan blank.
        if (event.kind !== "standardFontDataUrl") {
          setState((current) => ({ ...current, incomplete: true }));
        }
        break;
      default:
        break;
    }
  }, []);

  const goTo = useCallback((page: number) => {
    const { count } = latest.current;
    if (count < 1 || !Number.isFinite(page)) return;
    const target = Math.min(count, Math.max(1, Math.trunc(page)));
    sandbox.current?.goto(target);
    setState((current) => ({ ...current, page: target }));
  }, []);

  const step = useCallback(
    (direction: -1 | 1) => goTo(latest.current.page + direction),
    [goTo],
  );

  const zoomTo = useCallback((zoom: number) => {
    sandbox.current?.zoom(zoom);
    setState((current) => ({ ...current, zoom }));
  }, []);
  const zoomIn = useCallback(
    () => zoomTo(stepPdfZoom(latest.current.zoom, 1)),
    [zoomTo],
  );
  const zoomOut = useCallback(
    () => zoomTo(stepPdfZoom(latest.current.zoom, -1)),
    [zoomTo],
  );
  const fitWidth = useCallback(() => zoomTo(1), [zoomTo]);

  const pressKey = useCallback(
    (key: PdfForwardedKey): boolean => {
      switch (key) {
        case "+":
        case "=":
          zoomIn();
          return true;
        case "-":
        case "_":
          zoomOut();
          return true;
        case "0":
          fitWidth();
          return true;
        default:
          return false;
      }
    },
    [zoomIn, zoomOut, fitWidth],
  );

  return useMemo(
    () => ({
      state,
      attach,
      report,
      goTo,
      step,
      zoomIn,
      zoomOut,
      fitWidth,
      pressKey,
    }),
    [state, attach, report, goTo, step, zoomIn, zoomOut, fitWidth, pressKey],
  );
}
