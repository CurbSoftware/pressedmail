import { useCallback, useEffect, useState } from "react";

import {
  apiFetch,
  isAbortError,
  isNetworkFetchError,
  isRequestTimeoutError,
} from "@/lib/api-client";

import {
  buildAttachmentPreviewUrl,
  type AttachmentPreviewContext,
  type AttachmentPreviewKind,
} from "./previewable";

/** What went wrong, in the terms the person needs: each one reads differently. */
export type AttachmentPreviewErrorKind =
  | "too_large"
  | "unsupported"
  | "broken"
  | "disabled"
  | "changed"
  | "rate_limited"
  | "network"
  | "missing"
  | "failed"
  // A PDF that needs its password to open.
  | "password"
  // A PDF that is cut short or not a PDF underneath.
  | "damaged"
  // The PDF viewer could not start or stopped answering.
  | "viewer"
  // The browser is too old to run the PDF viewer.
  | "browser"
  // The viewer ran and could not draw the file: its first page failed and no other page drew.
  | "render";

export type AttachmentPreviewState =
  | { status: "loading" }
  | {
      status: "ready";
      kind: AttachmentPreviewKind;
      /** A blob URL, revoked when the attachment changes or the dialog closes. */
      url: string;
      /** The type the server decided from the bytes. */
      type: string;
      bytes: number;
      /** The file itself. The PDF viewer reads its bytes, and a PDF the viewer cannot open is handed to the browser. */
      blob: Blob;
    }
  | {
      status: "error";
      kind: AttachmentPreviewErrorKind;
      /** Kept when the bytes arrived and the viewer then failed, so "Open in a new tab" still has something to open. */
      blob?: Blob;
    };

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

function kindOfType(type: string): AttachmentPreviewKind | null {
  if (IMAGE_TYPES.has(type)) return "image";
  return type === "application/pdf" ? "pdf" : null;
}

/** The `code` of a JSON error body, or "" when there is none. */
async function readErrorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      code?: unknown;
      data?: { code?: unknown } | null;
    } | null;
    const code = body?.code ?? body?.data?.code;
    return typeof code === "string" ? code : "";
  } catch {
    return "";
  }
}

function errorKindFor(
  status: number,
  code: string,
): AttachmentPreviewErrorKind {
  if (code === "preview_too_large" || status === 413) return "too_large";
  if (code === "preview_unsupported" || status === 415) return "unsupported";
  if (code === "downloads_disabled") return "disabled";
  if (code === "rate_limited" || status === 429) return "rate_limited";
  if (code === "message_changed" || (status === 409 && code === ""))
    return "changed";
  if (status === 404) return "missing";
  return "failed";
}

/**
 * Fetch one attachment for the preview and keep it as a blob URL for exactly
 * as long as it is on screen. A new attachment, a retry or an unmount aborts
 * the request in flight and revokes the URL, so nothing lingers in memory.
 */
export function useAttachmentPreview(
  context: AttachmentPreviewContext,
  index: number,
) {
  const url = buildAttachmentPreviewUrl(context, index);
  const [state, setState] = useState<AttachmentPreviewState>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url) {
      // No usable message identity: the same advice as a changed message.
      setState({ status: "error", kind: "changed" });
      return;
    }

    const controller = new AbortController();
    let live = true;
    let objectUrl: string | null = null;
    setState({ status: "loading" });

    void (async () => {
      try {
        const response = await apiFetch(url, { signal: controller.signal });
        if (!live) return;
        if (!response.ok) {
          const code = await readErrorCode(response);
          if (live)
            setState({
              status: "error",
              kind: errorKindFor(response.status, code),
            });
          return;
        }
        const blob = await response.blob();
        if (!live) return;
        const kind = kindOfType(blob.type);
        if (!kind) {
          setState({ status: "error", kind: "unsupported" });
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setState({
          status: "ready",
          kind,
          url: objectUrl,
          type: blob.type,
          bytes: blob.size,
          blob,
        });
      } catch (error) {
        if (!live || isAbortError(error)) return;
        setState({
          status: "error",
          kind:
            isNetworkFetchError(error) || isRequestTimeoutError(error)
              ? "network"
              : "failed",
        });
      }
    })();

    return () => {
      live = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  /** The bytes arrived but the viewer could not show them. */
  const markFailed = useCallback(
    (kind: AttachmentPreviewErrorKind) =>
      setState((current) =>
        current.status === "ready"
          ? { status: "error", kind, blob: current.blob }
          : current,
      ),
    [],
  );
  /** The browser could not draw an image. */
  const markBroken = useCallback(() => markFailed("broken"), [markFailed]);

  return { state, retry, markBroken, markFailed };
}
