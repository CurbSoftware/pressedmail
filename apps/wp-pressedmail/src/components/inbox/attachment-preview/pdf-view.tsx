import * as React from "react";
import { __, _n, sprintf } from "@wordpress/i18n";

import { Skeleton } from "@kit/ui/plugin";

import { getRuntimeAssetsUrl, getRuntimeLocaleTag } from "@/lib/runtime-config";

import { createPdfSandbox } from "./pdf-sandbox/pdf-sandbox";
import type { PdfErrorCode } from "./pdf-sandbox/protocol";
import type { PdfViewer } from "./pdf-viewer-state";
import { DownloadInsteadButton } from "./preview-error";
import type { AttachmentPreviewErrorKind } from "./use-attachment-preview";

/**
 * What each way the viewer can end means to the person. A password and a damaged file say so. A browser too old for
 * the build says that, and a first page that would not draw says the preview could not draw the file, which is true
 * of a broken file and of a browser that lacks something alike. Everything else is "the viewer didn't start", which
 * has a retry and a way around it.
 */
export function failureKindFor(code: PdfErrorCode): AttachmentPreviewErrorKind {
  switch (code) {
    case "password":
      return "password";
    case "invalid":
    case "missing":
      return "damaged";
    case "unsupported":
      return "browser";
    case "render":
      return "render";
    default:
      return "viewer";
  }
}

interface PdfViewProps {
  /** The PDF, as the server sent it. Its bytes go to the viewer; this component never shows a string from the file. */
  blob: Blob;
  /** The file name. Names the viewer's frame for assistive technology. */
  title: string;
  /** The toolbar's half of the viewer, owned by the dialog so its buttons and keys drive the same state. */
  viewer: PdfViewer;
  canDownload: boolean;
  onDownload: () => void;
  /** The viewer could not show the file. The dialog swaps this for the matching message. */
  onFail: (kind: AttachmentPreviewErrorKind) => void;
  /** Escape was pressed inside the viewer, where the dialog cannot hear it. */
  onClose: () => void;
}

/**
 * One PDF, drawn page by page inside a sandboxed frame (see pdf-sandbox/pdf-sandbox.ts for why). Everything a person
 * reads or presses is here, in the page's own document: the toolbar, the page count, the messages. The frame holds
 * only the pages, and gets two label templates it fills in with textContent.
 */
export function PdfView({
  blob,
  title,
  viewer,
  canDownload,
  onDownload,
  onFail,
  onClose,
}: PdfViewProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const { attach, report, pressKey } = viewer;
  // The sandbox outlives a render, so what it calls must not be a stale closure.
  const handlers = React.useRef({ onFail, onClose });
  handlers.current = { onFail, onClose };

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const sandbox = createPdfSandbox({
      host,
      // Read in a promise so a blob that cannot be read becomes a failure of the viewer, not a throw in an effect.
      bytes: Promise.resolve().then(() => blob.arrayBuffer()),
      assetsUrl: getRuntimeAssetsUrl(),
      title: sprintf(__("Preview of %s", "pressedmail"), title),
      labels: {
        // The frame fills {n} and {total} in with textContent, so these are templates and not sentences.
        pageLabel: sprintf(
          /* translators: 1: {n}, the page number. 2: {total}, how many pages the PDF has. Keep both placeholders as they are. */
          __("Page %1$s of %2$s", "pressedmail"),
          "{n}",
          "{total}",
        ),
        pageError: sprintf(
          /* translators: %s: {n}, the page number. Keep the placeholder as it is. */
          __("Page %s could not be shown", "pressedmail"),
          "{n}",
        ),
        lang: getRuntimeLocaleTag(),
      },
      onEvent: (event) => {
        if (event.t === "error") {
          handlers.current.onFail(failureKindFor(event.code));
        } else if (event.t === "key") {
          if (event.key === "Escape") handlers.current.onClose();
          else pressKey(event.key);
        } else {
          report(event);
        }
      },
    });
    attach(sandbox);
    return () => {
      attach(null);
      sandbox.destroy();
    };
  }, [blob, title, attach, report, pressKey]);

  const { ready, total, count, incomplete } = viewer.state;
  const capped = total > count && count > 0;

  return (
    <div className="relative flex h-full w-full flex-col">
      {incomplete || capped ? (
        <div className="shrink-0 border-b border-border bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
          {incomplete ? (
            <p role="status">
              {__(
                "Some text or images may be missing from this preview. Download the file to see everything.",
                "pressedmail",
              )}
            </p>
          ) : null}
          {capped ? (
            <p role="status">
              {sprintf(
                __(
                  "Showing the first %1$d of %2$d pages. Download the file to read the rest.",
                  "pressedmail",
                ),
                count,
                total,
              )}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1">
        <div ref={hostRef} className="absolute inset-0" />
        {!ready ? (
          <div
            role="status"
            className="absolute inset-0 grid place-items-center bg-muted/40 p-6">
            <span className="sr-only">
              {__("Loading preview", "pressedmail")}
            </span>
            <Skeleton
              aria-hidden="true"
              className="h-full max-h-96 w-full max-w-2xl motion-reduce:animate-none"
            />
          </div>
        ) : null}
      </div>
      {/* The pages are pictures, so a screen reader gets the count and the way to the text instead. Visible only on focus. */}
      <div className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:start-3 focus-within:bottom-3 focus-within:z-10 focus-within:flex focus-within:max-w-sm focus-within:flex-col focus-within:gap-2 focus-within:rounded-md focus-within:border focus-within:border-border focus-within:bg-background focus-within:p-3 focus-within:text-sm focus-within:shadow-md">
        <div role="status">
          {total > 0 ? (
            <>
              <p>
                {sprintf(
                  _n(
                    "This PDF has %d page.",
                    "This PDF has %d pages.",
                    total,
                    "pressedmail",
                  ),
                  total,
                )}
              </p>
              <p>
                {__(
                  "The pages are shown as pictures, so a screen reader can't read their text here.",
                  "pressedmail",
                )}
              </p>
            </>
          ) : null}
        </div>
        {canDownload && total > 0 ? (
          <DownloadInsteadButton onDownload={onDownload} />
        ) : null}
      </div>
    </div>
  );
}
