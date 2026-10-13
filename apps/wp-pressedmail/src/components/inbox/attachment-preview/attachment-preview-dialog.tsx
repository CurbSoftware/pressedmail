import * as React from "react";
import { __, sprintf } from "@wordpress/i18n";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Maximize2,
  Minimize2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button, Dialog, Skeleton } from "@kit/ui/plugin";

import { useAppFrameRect } from "@/hooks/useAppFrameRect";
import { cn } from "@/lib/utils";
import {
  PressedDialogContent,
  PressedDialogHeader,
} from "@/components/ui/pressed-overlay";

import { formatFileSize } from "../compose/compose-utils";
import { ImageView } from "./image-view";
import { useImageViewport } from "./image-viewport";
import { openPdfInNewTab } from "./open-pdf-in-new-tab";
import { PdfControls } from "./pdf-controls";
import { PdfView } from "./pdf-view";
import { usePdfViewer } from "./pdf-viewer-state";
import { AttachmentPreviewError } from "./preview-error";
import {
  previewTypeLabel,
  type AttachmentPreviewContext,
  type AttachmentPreviewItem,
} from "./previewable";
import { ToolbarButton } from "./toolbar-button";
import { useAttachmentPreview } from "./use-attachment-preview";

/** Tailwind's `sm`. Narrower than this the dialog is a full-screen sheet. */
const PHONE_WIDTH = 640;

/**
 * Whether the plugin is phone-wide, and the box to fill when it is. The app
 * frame is the measure, not the window: wp-admin's menu and bar take their
 * share, and a dialog as tall as the window would slide under the bar.
 */
function usePhoneSheet(): React.CSSProperties | undefined {
  const frame = useAppFrameRect(true);
  const query = `(max-width: ${PHONE_WIDTH - 1}px)`;
  const [narrow, setNarrow] = React.useState(() =>
    typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
  );
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const update = () => setNarrow(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);

  const phone = frame ? frame.width < PHONE_WIDTH : narrow;
  if (!phone) return undefined;
  return frame
    ? { width: frame.width, height: frame.height, maxHeight: "none" }
    : { width: "100vw", height: "100dvh", maxHeight: "none" };
}

/** A field being typed in keeps its keys: the page box takes digits, and arrows move its caret. */
function isEditable(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      /^(input|textarea|select)$/i.test(target.tagName))
  );
}

interface AttachmentPreviewDialogProps {
  context: AttachmentPreviewContext;
  /** Every attachment of the message that can be previewed, in message order. */
  items: AttachmentPreviewItem[];
  /** The message index of the one on show. */
  activeIndex: number;
  /** The administrator's switch. A preview hands over the bytes, so it obeys it. */
  canDownload: boolean;
  onActiveIndexChange: (index: number) => void;
  onDownload: (index: number) => void;
  onClose: () => void;
  /** What had focus before the dialog opened. The dialog primitive only restores focus to a trigger. */
  returnFocusTo?: HTMLElement | null;
}

export function AttachmentPreviewDialog({
  context,
  items,
  activeIndex,
  canDownload,
  onActiveIndexChange,
  onDownload,
  onClose,
  returnFocusTo,
}: AttachmentPreviewDialogProps) {
  const position = items.findIndex((entry) => entry.index === activeIndex);
  const item = items[position];
  const { state, retry, markBroken, markFailed } = useAttachmentPreview(
    context,
    activeIndex,
  );
  const viewport = useImageViewport();
  const pdf = usePdfViewer();
  const sheetStyle = usePhoneSheet();

  if (!item) return null;

  const title =
    item.filename ||
    sprintf(__("Attachment %d", "pressedmail"), item.index + 1);
  const typeLabel = previewTypeLabel(
    state.status === "ready" ? state.type : item.mimeType,
    item.filename,
  );
  const bytes = state.status === "ready" ? state.bytes : item.size;
  const sizeLabel = bytes > 0 ? formatFileSize(bytes) : "";
  const download = () => onDownload(item.index);
  const imageReady =
    state.status === "ready" &&
    state.kind === "image" &&
    viewport.image.width > 0;
  const pdfReady =
    state.status === "ready" &&
    state.kind === "pdf" &&
    pdf.state.ready &&
    pdf.state.count > 0;

  const go = (step: -1 | 1) => {
    const next = items[position + step];
    if (next) onActiveIndexChange(next.index);
  };

  // On the live ring an arrow pressed while a toolbar button held focus never
  // reached the bubble handler below, so stepping and the zoom keys died after
  // any toolbar click. Capture sees the key wherever focus sits inside the
  // dialog. The image stage keeps first claim on arrows while a picture is
  // zoomed (it pans and stops the event itself), so keys from the stage are
  // left to it; at the fit the stage lets them go and the bubble handler below
  // still steps, as before.
  const onKeyDownCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest("[data-pm-preview-stage]")
    )
      return;
    onKeyDown(event);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      isEditable(event.target)
    )
      return;
    const rtl = document.documentElement.dir === "rtl";
    switch (event.key) {
      case "ArrowLeft":
        go(rtl ? 1 : -1);
        break;
      case "ArrowRight":
        go(rtl ? -1 : 1);
        break;
      case "+":
      case "=":
        if (imageReady) viewport.zoomIn();
        else if (pdfReady) pdf.zoomIn();
        else return;
        break;
      case "-":
      case "_":
        if (imageReady) viewport.zoomOut();
        else if (pdfReady) pdf.zoomOut();
        else return;
        break;
      case "0":
        if (imageReady) viewport.fitToStage();
        else if (pdfReady) pdf.fitWidth();
        else return;
        break;
      case "1":
        if (!imageReady) return;
        viewport.actualSize();
        break;
      case "PageDown":
        if (!pdfReady) return;
        pdf.step(1);
        break;
      case "PageUp":
        if (!pdfReady) return;
        pdf.step(-1);
        break;
      case "Home":
        if (!pdfReady) return;
        pdf.goTo(1);
        break;
      case "End":
        if (!pdfReady) return;
        pdf.goTo(pdf.state.count);
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  let stage: React.ReactNode;
  if (state.status === "loading") {
    stage = (
      <div role="status" className="grid h-full place-items-center p-6">
        <span className="sr-only">{__("Loading preview", "pressedmail")}</span>
        <Skeleton
          aria-hidden="true"
          className="h-full max-h-96 w-full max-w-2xl motion-reduce:animate-none"
        />
      </div>
    );
  } else if (state.status === "error") {
    // Set when the bytes arrived and the viewer then failed: the browser may still open the file.
    const rescue = state.blob;
    stage = (
      <AttachmentPreviewError
        kind={state.kind}
        canDownload={canDownload}
        onDownload={download}
        onRetry={retry}
        onOpenInNewTab={rescue ? () => openPdfInNewTab(rescue) : undefined}
      />
    );
  } else if (state.kind === "pdf") {
    stage = (
      <PdfView
        key={state.url}
        blob={state.blob}
        title={title}
        viewer={pdf}
        canDownload={canDownload}
        onDownload={download}
        onFail={markFailed}
        onClose={onClose}
      />
    );
  } else {
    stage = (
      <ImageView
        key={state.url}
        url={state.url}
        alt={title}
        label={sprintf(__("Preview of %s", "pressedmail"), title)}
        viewport={viewport}
        onBroken={markBroken}
      />
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}>
      <PressedDialogContent
        size="workspace"
        showCloseButton={false}
        style={sheetStyle}
        className={cn(
          "flex flex-col outline-none motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none",
          sheetStyle
            ? "rounded-none border-0"
            : "h-[min(calc(100dvh-2rem),52rem)]",
        )}
        onKeyDown={onKeyDown}
        onKeyDownCapture={onKeyDownCapture}
        // Open on the dialog itself, not its first button. That button is
        // Previous, and on the first file it is the one that is off. The arrow
        // keys and + and - work from here without a click, and a screen reader
        // reads the file name before anything else.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (returnFocusTo?.isConnected) returnFocusTo.focus();
        }}>
        <PressedDialogHeader
          icon={Eye}
          title={<span className="[overflow-wrap:anywhere]">{title}</span>}
          description={
            <span className="inline-flex flex-wrap items-center gap-x-1.5">
              {typeLabel ? <span>{typeLabel}</span> : null}
              {typeLabel && sizeLabel ? (
                <span aria-hidden="true">·</span>
              ) : null}
              {sizeLabel ? <span>{sizeLabel}</span> : null}
            </span>
          }
        />
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-1.5">
          {items.length > 1 ? (
            <div className="flex items-center gap-0.5">
              <ToolbarButton
                label={__("Previous attachment", "pressedmail")}
                // Stays focusable at the end of the row, so a keyboard user
                // who just arrived there keeps their place in the dialog.
                focusableWhenDisabled
                disabled={position <= 0}
                onClick={() => go(-1)}>
                <ChevronLeft className="rtl:rotate-180" />
              </ToolbarButton>
              <span
                aria-live="polite"
                className="min-w-14 text-center text-sm text-muted-foreground tabular-nums">
                {sprintf(
                  __("%1$d of %2$d", "pressedmail"),
                  position + 1,
                  items.length,
                )}
              </span>
              <ToolbarButton
                label={__("Next attachment", "pressedmail")}
                focusableWhenDisabled
                disabled={position >= items.length - 1}
                onClick={() => go(1)}>
                <ChevronRight className="rtl:rotate-180" />
              </ToolbarButton>
            </div>
          ) : null}
          {state.status === "ready" && state.kind === "image" ? (
            <div className="flex items-center gap-0.5">
              <ToolbarButton
                label={__("Zoom out", "pressedmail")}
                disabled={!imageReady}
                onClick={() => viewport.zoomOut()}>
                <ZoomOut />
              </ToolbarButton>
              <output
                aria-label={__("Zoom level", "pressedmail")}
                className="min-w-12 text-center text-sm text-muted-foreground tabular-nums">
                {viewport.percent}%
              </output>
              <ToolbarButton
                label={__("Zoom in", "pressedmail")}
                disabled={!imageReady}
                onClick={() => viewport.zoomIn()}>
                <ZoomIn />
              </ToolbarButton>
              <ToolbarButton
                label={__("Fit to window", "pressedmail")}
                disabled={!imageReady}
                onClick={viewport.fitToStage}>
                <Minimize2 />
              </ToolbarButton>
              <ToolbarButton
                label={__("Actual size", "pressedmail")}
                disabled={!imageReady}
                onClick={viewport.actualSize}>
                <Maximize2 />
              </ToolbarButton>
            </div>
          ) : null}
          {state.status === "ready" && state.kind === "pdf" ? (
            <PdfControls viewer={pdf} />
          ) : null}
          <div className="ms-auto flex items-center gap-1">
            {canDownload ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="pointer-coarse:min-h-11"
                onClick={download}>
                <Download aria-hidden="true" />
                {__("Download", "pressedmail")}
              </Button>
            ) : null}
            <ToolbarButton
              label={__("Close preview", "pressedmail")}
              onClick={onClose}>
              <X />
            </ToolbarButton>
          </div>
        </div>
        <div className="relative min-h-0 flex-1 bg-muted/40">{stage}</div>
      </PressedDialogContent>
    </Dialog>
  );
}
