/**
 * Signature Service
 *
 * Handles signature insertion, extraction, and replacement in email content.
 * Uses HTML markers to uniquely identify signature blocks for reliable manipulation.
 */

import type { ComposeMode } from "@/components/inbox/compose/compose-utils";
import { plainTextToComposerHtml } from "@/lib/composer/plain-text-content";
import type { Signature, SignaturePosition } from "@/types/signatures";

// Editable signature container. Emitted as the TipTap `SignatureBlock` node
// markup (`div[data-pm-block="signature"]`) so the composer parses the
// auto-inserted / picked signature into a real, EDITABLE block rather than a
// frozen chunk of HTML. The block round-trips through the editor unchanged,
// which keeps the editor and the preview in sync.
const SIGNATURE_BLOCK = "signature";
// Matches the opening tag of a signature block regardless of attribute order.
const SIGNATURE_OPEN_RE = new RegExp(
  `<div\\b[^>]*\\bdata-pm-block=["']${SIGNATURE_BLOCK}["'][^>]*>`,
  "i",
);

// Legacy comment-marker format. Older drafts (saved before the editable-block
// migration) still carry these, so detection/removal must recognize them.
const LEGACY_START_MARKER = "<!-- pressedmail:signature:start -->";
const LEGACY_END_MARKER = "<!-- pressedmail:signature:end -->";

export interface SignatureInsertOptions {
  position?: SignaturePosition;
  replaceExisting?: boolean;
  addSeparator?: boolean;
}

/**
 * Wraps signature content in the editable SignatureBlock node markup.
 */
export function wrapSignatureContent(
  content: string,
  addSeparator = true,
): string {
  const separator = addSeparator ? "<p>--</p>" : "";
  return `<div data-pm-block="${SIGNATURE_BLOCK}">${separator}<div class="signature-content">${content}</div></div>`;
}

/** Quoted senders retain their markers; they never belong to this compose. */
function isInsideQuotedContent(html: string, offset: number): boolean {
  const prefix = html.slice(0, offset);
  if (!/blockquote|gmail_quote|data-pm-block\s*=\s*["']?quote/i.test(prefix))
    return false;
  const document = new DOMParser().parseFromString(
    `${prefix}<pm-signature-boundary></pm-signature-boundary>`,
    "text/html",
  );
  const boundaries = document.querySelectorAll("pm-signature-boundary");
  const boundary = boundaries[boundaries.length - 1];
  return (
    !boundary ||
    Boolean(
      boundary.closest('blockquote, [data-pm-block="quote"], .gmail_quote'),
    )
  );
}

/**
 * Finds the [start, end) span of the first authored signature block, or null.
 * Handles both the new node markup (balancing nested <div>s) and the legacy
 * comment-marker format.
 */
function findSignatureSpan(
  html: string,
): { start: number; end: number } | null {
  const candidates = new RegExp(SIGNATURE_OPEN_RE, "gi");
  let open: RegExpExecArray | null;
  while ((open = candidates.exec(html)) !== null) {
    if (isInsideQuotedContent(html, open.index)) continue;
    const start = open.index;
    let depth = 1;
    const tagRe = /<\/?div\b[^>]*>/gi;
    tagRe.lastIndex = start + open[0].length;
    let tag: RegExpExecArray | null;
    while ((tag = tagRe.exec(html)) !== null) {
      if (tag[0].startsWith("</")) {
        depth -= 1;
        if (depth === 0) {
          return { start, end: tag.index + tag[0].length };
        }
      } else {
        depth += 1;
      }
    }
    // Unbalanced markup, fall through to legacy detection.
  }

  let legacyStart = html.indexOf(LEGACY_START_MARKER);
  while (legacyStart !== -1) {
    const legacyEnd = html.indexOf(
      LEGACY_END_MARKER,
      legacyStart + LEGACY_START_MARKER.length,
    );
    if (legacyEnd !== -1 && !isInsideQuotedContent(html, legacyStart))
      return { start: legacyStart, end: legacyEnd + LEGACY_END_MARKER.length };
    legacyStart = html.indexOf(
      LEGACY_START_MARKER,
      legacyStart + LEGACY_START_MARKER.length,
    );
  }

  return null;
}

/** Exact editable block, including nested markup, for automatic-insertion ownership. */
export function signatureSnapshot(html: string): string | null {
  const span = findSignatureSpan(html);
  return span ? html.slice(span.start, span.end) : null;
}

/**
 * Extracts signature content from email body (without the wrapper).
 */
export function extractSignatureContent(html: string): string | null {
  const span = findSignatureSpan(html);
  if (!span) return null;

  const block = html.slice(span.start, span.end);
  const contentMatch = block.match(
    /<div class="signature-content">([\s\S]*?)<\/div>/,
  );
  return contentMatch?.[1]?.trim() ?? block.trim();
}

/**
 * Checks if the email body contains a signature block (new or legacy format).
 */
export function hasSignature(html: string): boolean {
  return findSignatureSpan(html) !== null;
}

/**
 * Removes the signature block from the email body (new or legacy format).
 */
export function removeSignature(html: string): string {
  const span = findSignatureSpan(html);
  if (!span) return html;

  // Clean up any trailing whitespace/breaks before the signature.
  const before = html.slice(0, span.start).replace(/(<br\s*\/?>|\n|\s)*$/, "");
  const after = html.slice(span.end);

  return before + after;
}

/**
 * Replaces existing signature with new one
 */
export function replaceSignature(
  html: string,
  signature: Pick<Signature, "content" | "content_type">,
  addSeparator = true,
): string {
  const bodyWithoutSignature = removeSignature(html);
  return insertSignature(bodyWithoutSignature, signature, {
    position: "after",
    addSeparator,
  });
}

/**
 * Inserts signature into email body
 */
export function insertSignature(
  html: string,
  signature: Pick<Signature, "content" | "content_type">,
  options: SignatureInsertOptions = {},
): string {
  const {
    position = "after",
    replaceExisting = true,
    addSeparator = true,
  } = options;

  // If replacing and signature exists, remove it first
  let body = html;
  if (replaceExisting && hasSignature(body)) {
    body = removeSignature(body);
  }

  const wrappedSignature = wrapSignatureContent(
    signature.content_type === "plain"
      ? plainTextToComposerHtml(signature.content)
      : signature.content,
    addSeparator,
  );

  switch (position) {
    case "before":
      return wrappedSignature + "\n" + body;

    case "after":
    default: {
      // Add some spacing before signature
      const spacing = body.trim() ? "<br><br>" : "";
      return body + spacing + wrappedSignature;
    }
  }
}

/**
 * Gets the body content without signature (for display purposes)
 */
export function getBodyWithoutSignature(html: string): string {
  return removeSignature(html);
}

/**
 * Inserts a signature block for a reply/forward at the bottom of the NEW
 * message: directly above the `<hr>` separator that divides it from the
 * quoted original. Falls back to the quoted-block markers (then end-of-body)
 * when no separator is present.
 */
export function insertSignatureForReply(
  html: string,
  signature: Pick<Signature, "content" | "content_type">,
  quotedContentMarker?: string,
): string {
  // Boundary markers, in document order. The composer scaffold emits an <hr>
  // separator immediately above the "On … wrote:" / "Forwarded message"
  // reference line and the quoted block, so anchoring on it keeps the
  // signature at the foot of the new message rather than between the header
  // and the quote. The remaining markers cover externally-sourced drafts.
  const quoteMarkers = [
    quotedContentMarker,
    "<hr",
    '<div class="gmail_quote"',
    "<blockquote",
    '<div class="moz-cite-prefix"',
    "<!-- quoted-content -->",
  ].filter(Boolean) as string[];

  // Find the first quote marker
  let quoteIndex = -1;
  for (const marker of quoteMarkers) {
    const idx = html.indexOf(marker);
    if (idx !== -1 && (quoteIndex === -1 || idx < quoteIndex)) {
      quoteIndex = idx;
    }
  }

  const wrappedSignature = wrapSignatureContent(
    signature.content_type === "plain"
      ? plainTextToComposerHtml(signature.content)
      : signature.content,
    true,
  );

  if (quoteIndex === -1) {
    // No quoted content found, append to end
    return html + "<br><br>" + wrappedSignature;
  }

  // Insert signature before quoted content
  const beforeQuote = html.substring(0, quoteIndex);
  const afterQuote = html.substring(quoteIndex);

  return beforeQuote + "<br><br>" + wrappedSignature + "<br><br>" + afterQuote;
}

export interface ApplySignatureOptions {
  /** Compose mode: reply/reply-all/forward anchor above the quote separator. */
  mode?: ComposeMode;
  /** Strip any existing signature block first (used when swapping). */
  replaceExisting?: boolean;
  /** Preference: append at the end, or sit above the quoted original. */
  placement?: "end" | "before_quote";
}

/**
 * Single entry point for placing a signature in a composer body, used by both
 * the auto-insert mount effect and the toolbar picker so placement never
 * diverges. Reply/forward bodies (or any body that already carries the `<hr>`
 * separator or a quoted block) get the signature anchored at the foot of the
 * new message, directly above that separator; new-message bodies get it
 * appended after the content.
 */
export function applySignature(
  html: string,
  signature: Pick<Signature, "content" | "content_type">,
  options: ApplySignatureOptions = {},
): string {
  const { mode = "new", replaceExisting = true, placement } = options;
  const base = replaceExisting ? removeSignature(html) : html;

  const replyish =
    mode === "reply" || mode === "reply-all" || mode === "forward";
  const placeBeforeQuote =
    placement === "before_quote" || (placement !== "end" && replyish);
  if (
    placeBeforeQuote &&
    (replyish || /<hr\b|<blockquote|class="gmail_quote"/i.test(base))
  ) {
    return insertSignatureForReply(base, signature);
  }

  return insertSignature(base, signature, {
    position: "after",
    replaceExisting: false,
    addSeparator: true,
  });
}

/**
 * Utility to check if content is empty (ignoring whitespace and empty tags)
 */
export function isContentEmpty(html: string): boolean {
  if (!html) return true;

  // Remove HTML tags and whitespace
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

  return text.length === 0;
}

/**
 * Prepares email body for sending (cleans up markers if needed)
 */
export function prepareBodyForSend(html: string): string {
  // Keep the signature markers - they're HTML comments and won't affect display
  // The markers help identify signatures in received emails
  return html;
}
