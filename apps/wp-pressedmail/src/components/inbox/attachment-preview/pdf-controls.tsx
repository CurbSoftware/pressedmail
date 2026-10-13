import * as React from "react";
import { __, sprintf } from "@wordpress/i18n";
import {
  ChevronLeft,
  ChevronRight,
  MoveHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Input } from "@kit/ui/plugin";

import type { PdfViewer } from "./pdf-viewer-state";
import { ToolbarButton } from "./toolbar-button";

/** The current page as a box you can type a page into. The number commits on Enter or when you leave the box. */
function PageField({ viewer }: { viewer: PdfViewer }) {
  const { page, count, ready } = viewer.state;
  // What is being typed, or null when the box just follows the page on screen.
  const [draft, setDraft] = React.useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const wanted = Number.parseInt(draft, 10);
    setDraft(null);
    if (Number.isFinite(wanted)) viewer.goTo(wanted);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={__("Page number", "pressedmail")}
        disabled={!ready}
        value={draft ?? String(page)}
        onChange={(event) =>
          setDraft(event.target.value.replace(/\D/g, "").slice(0, 6))
        }
        onFocus={(event) => event.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        className="w-14 px-1 text-center tabular-nums pointer-coarse:min-h-11!"
      />
      <span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
        {sprintf(
          /* translators: %d: how many pages the PDF has. Shown after the box holding the current page, as in "3 of 30". */
          __("of %d", "pressedmail"),
          count,
        )}
      </span>
    </div>
  );
}

/**
 * The PDF's half of the dialog toolbar: page controls, then zoom. The dialog's own keys drive the same viewer, so the
 * buttons are the visible form of PageUp, PageDown, Home, End, plus, minus and zero.
 */
export function PdfControls({ viewer }: { viewer: PdfViewer }) {
  const { page, count, ready, zoom } = viewer.state;
  const usable = ready && count > 0;
  return (
    <>
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          label={__("Previous page", "pressedmail")}
          disabled={!usable || page <= 1}
          onClick={() => viewer.step(-1)}>
          <ChevronLeft className="rtl:rotate-180" />
        </ToolbarButton>
        <PageField viewer={viewer} />
        <ToolbarButton
          label={__("Next page", "pressedmail")}
          disabled={!usable || page >= count}
          onClick={() => viewer.step(1)}>
          <ChevronRight className="rtl:rotate-180" />
        </ToolbarButton>
      </div>
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          label={__("Zoom out", "pressedmail")}
          disabled={!usable}
          onClick={viewer.zoomOut}>
          <ZoomOut />
        </ToolbarButton>
        <output
          aria-label={__("Zoom level", "pressedmail")}
          className="min-w-12 text-center text-sm text-muted-foreground tabular-nums">
          {Math.round(zoom * 100)}%
        </output>
        <ToolbarButton
          label={__("Zoom in", "pressedmail")}
          disabled={!usable}
          onClick={viewer.zoomIn}>
          <ZoomIn />
        </ToolbarButton>
        <ToolbarButton
          label={__("Fit width", "pressedmail")}
          disabled={!usable}
          onClick={viewer.fitWidth}>
          <MoveHorizontal />
        </ToolbarButton>
      </div>
    </>
  );
}
