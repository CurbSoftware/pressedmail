import * as React from "react";
import { __ } from "@wordpress/i18n";
import { CircleAlert, Download, ExternalLink } from "lucide-react";

import { Button } from "@kit/ui/plugin";

import type { AttachmentPreviewErrorKind } from "./use-attachment-preview";

/** The words for each way a preview can fail. Read at render, so a locale change is picked up. */
function messageFor(kind: AttachmentPreviewErrorKind): string {
  switch (kind) {
    case "too_large":
      return __(
        "This file is too large to preview. Download it to open it instead.",
        "pressedmail",
      );
    case "unsupported":
      return __(
        "This kind of file can't be previewed. Download it to open it instead.",
        "pressedmail",
      );
    case "broken":
      return __(
        "This image won't display. Download it to open it instead.",
        "pressedmail",
      );
    case "disabled":
      return __(
        "Your administrator has turned off attachment downloads, and that includes previews.",
        "pressedmail",
      );
    case "changed":
      return __(
        "This message changed on the mail server. Reload the mailbox, then try again.",
        "pressedmail",
      );
    case "rate_limited":
      return __(
        "That's a lot of previews in a row. Wait a few seconds, then try again.",
        "pressedmail",
      );
    case "network":
      return __(
        "Couldn't reach your site. Check your connection, then try again.",
        "pressedmail",
      );
    case "missing":
      return __("This attachment isn't on the server anymore.", "pressedmail");
    case "failed":
      return __(
        "The preview didn't load. Try again, or download the file.",
        "pressedmail",
      );
    case "password":
      return __(
        "This PDF is password-protected. Download it to open it with the password.",
        "pressedmail",
      );
    case "damaged":
      return __(
        "This PDF looks damaged, so it can't be previewed. Download it to open it in another app.",
        "pressedmail",
      );
    case "viewer":
      return __(
        "The PDF viewer didn't start. Try again, download the file, or open it in a new tab.",
        "pressedmail",
      );
    case "browser":
      return __(
        "This browser is too old to preview PDFs. Download the file, or open it in a new tab.",
        "pressedmail",
      );
    case "render":
      return __(
        "The preview couldn't draw this PDF. Download the file, or open it in a new tab.",
        "pressedmail",
      );
  }
}

/** A retry can help: the server was busy, or the connection dropped. */
const RETRYABLE = new Set<AttachmentPreviewErrorKind>([
  "rate_limited",
  "network",
  "failed",
  "viewer",
]);
/** Opening the file is a fair answer when only the preview is the problem. */
const DOWNLOADABLE = new Set<AttachmentPreviewErrorKind>([
  "too_large",
  "unsupported",
  "broken",
  "failed",
  "password",
  "damaged",
  "viewer",
  "browser",
  "render",
]);
/**
 * The browser's own PDF viewer is the last resort, and only when ours is what
 * failed. A damaged file fails there too, and a password is better entered in
 * the app that will keep the file, so those two get Download alone.
 */
const OPENABLE = new Set<AttachmentPreviewErrorKind>([
  "viewer",
  "browser",
  "render",
]);

interface StageMessageProps {
  children: React.ReactNode;
  role: "alert" | "status";
  actions?: React.ReactNode;
}

/** A message centred on the stage, with room for a button or two. */
export function StageMessage({ children, role, actions }: StageMessageProps) {
  return (
    <div
      role={role}
      className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 py-8 text-center">
      <CircleAlert
        aria-hidden="true"
        className="size-8 text-muted-foreground"
      />
      <p className="max-w-md text-sm text-foreground">{children}</p>
      {actions ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function DownloadInsteadButton({
  onDownload,
}: {
  onDownload: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="pointer-coarse:min-h-11"
      onClick={onDownload}>
      <Download aria-hidden="true" />
      {__("Download", "pressedmail")}
    </Button>
  );
}

interface AttachmentPreviewErrorProps {
  kind: AttachmentPreviewErrorKind;
  /** The administrator's switch. Off, there is no fallback to offer. */
  canDownload: boolean;
  onDownload: () => void;
  onRetry: () => void;
  /** Hands the file to the browser's own viewer. Offered where it can help, and only with the administrator's switch on. */
  onOpenInNewTab?: () => void;
}

export function AttachmentPreviewError({
  kind,
  canDownload,
  onDownload,
  onRetry,
  onOpenInNewTab,
}: AttachmentPreviewErrorProps) {
  const actions = (
    <>
      {RETRYABLE.has(kind) ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="pointer-coarse:min-h-11"
          onClick={onRetry}>
          {__("Try again", "pressedmail")}
        </Button>
      ) : null}
      {canDownload && DOWNLOADABLE.has(kind) ? (
        <DownloadInsteadButton onDownload={onDownload} />
      ) : null}
      {canDownload && onOpenInNewTab && OPENABLE.has(kind) ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="pointer-coarse:min-h-11"
          onClick={onOpenInNewTab}>
          <ExternalLink aria-hidden="true" />
          {__("Open in new tab", "pressedmail")}
        </Button>
      ) : null}
    </>
  );

  return (
    <StageMessage role="alert" actions={actions}>
      {messageFor(kind)}
    </StageMessage>
  );
}
