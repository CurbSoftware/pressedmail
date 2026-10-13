import { parseMessageIdentityRef } from "@/lib/message-identity";
import { getPluginRestBase } from "@/lib/runtime-config";
import type { EmailAttachment } from "@/types";

/**
 * Whether a PDF gets a Preview button. The server detects PDFs from their bytes and serves them with the same checks
 * as an image, and the viewer is a sandboxed pdf.js frame (see pdf-sandbox/pdf-sandbox.ts). The flag is the one line
 * to turn if the viewer ever has to be pulled from a release: a PDF then goes back to Download alone.
 */
export const ATTACHMENT_PDF_PREVIEW_ENABLED = true;

export type AttachmentPreviewKind = "image" | "pdf";

/** Where a message lives: enough to ask the server for one of its attachments. */
export interface AttachmentPreviewContext {
  accountId: number | null;
  uid: string | number | null;
  uidValidity?: string | number;
  msgNo: string | number | null;
  folder: string;
}

/** One attachment the dialog can show. `index` is its place in the message, which is how the server finds it. */
export interface AttachmentPreviewItem {
  index: number;
  filename: string;
  size: number;
  mimeType: string;
}

type PreviewCandidate = Pick<
  EmailAttachment,
  "filename" | "mimeType" | "inline" | "contentId"
> & { mime?: string };

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);

function declaredType(attachment: PreviewCandidate): string {
  return (attachment.mimeType || attachment.mime || "")
    .toLowerCase()
    .split(";", 1)[0]!
    .trim();
}

function extensionOf(filename: string | undefined): string {
  const name = (filename || "").toLowerCase();
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1);
}

/**
 * What the sender says this is, from its declared type or its extension. Only a
 * hint for whether to offer Preview: the server decides from the bytes, and the
 * dialog shows whatever type comes back.
 */
export function declaredPreviewKind(
  attachment: PreviewCandidate,
): AttachmentPreviewKind | null {
  const type = declaredType(attachment);
  const extension = extensionOf(attachment.filename);
  if (IMAGE_TYPES.has(type) || IMAGE_EXTENSIONS.has(extension)) return "image";
  if (type === "application/pdf" || extension === "pdf") return "pdf";
  return null;
}

const TYPE_LABELS: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/jpg": "JPEG",
  "image/gif": "GIF",
  "image/webp": "WebP",
  "application/pdf": "PDF",
};

/**
 * A short format name for the dialog header, from the type the server found or,
 * until it answers, the one the sender declared. Format names are the same in
 * every language, like PNG and PDF on the file itself.
 */
export function previewTypeLabel(type: string, filename: string): string {
  const known = TYPE_LABELS[type.toLowerCase().split(";", 1)[0]!.trim()];
  if (known) return known;
  const extension = extensionOf(filename);
  return (
    TYPE_LABELS[`image/${extension}`] ?? (extension === "pdf" ? "PDF" : "")
  );
}

/**
 * An image the body shows through `cid:` (a signature logo, a pasted picture)
 * already renders in the message. Offering a popup for each would bury the
 * real attachments.
 */
function isInlineBodyPart(attachment: PreviewCandidate): boolean {
  return attachment.inline === true || Boolean(attachment.contentId);
}

export function isPreviewableAttachment(attachment: PreviewCandidate): boolean {
  if (isInlineBodyPart(attachment)) return false;
  const kind = declaredPreviewKind(attachment);
  return kind === "image" || (kind === "pdf" && ATTACHMENT_PDF_PREVIEW_ENABLED);
}

/**
 * The preview request for one attachment. The nonce travels in a header
 * (apiFetch), never in the URL, so it cannot end up in history or a log. Empty
 * when the message has no usable identity.
 */
export function buildAttachmentPreviewUrl(
  context: AttachmentPreviewContext,
  index: number,
): string {
  const ref = parseMessageIdentityRef({
    accountId: context.accountId,
    uid: context.uid,
    uidValidity: context.uidValidity,
    folder: context.folder,
  });
  if (!ref || !Number.isInteger(index) || index < 0 || index > 200) return "";
  const params = new URLSearchParams({
    index: String(index),
    folder: ref.folder,
    uid: ref.uid,
    uid_validity: ref.uidValidity,
  });
  return `${getPluginRestBase()}messages/attachment-preview/${ref.accountId}?${params.toString()}`;
}
