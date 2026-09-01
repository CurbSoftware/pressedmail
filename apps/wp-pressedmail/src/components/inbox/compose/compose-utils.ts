/**
 * Compose Utilities
 *
 * Shared utility functions for the email composer.
 * Extracted from ComposeForm and ComposePane to avoid duplication.
 *
 * @since 2.0.0
 */

import { __ } from "@wordpress/i18n";
import { format } from "date-fns";
import { parseEmailDate } from "@/lib/email-date";
import { parseSenderName } from "@/lib/mail-utils";
import type { EmailMessage } from "@/types";
import { resolveEmailBody } from "@/lib/email-content-normalization";

/**
 * Escape HTML entities for interpolation into markup.
 *
 * Inlined from the former src/lib/security.ts, which existed to export 28
 * helpers of which this was the only one anything imported.
 */
/**
 * Escape HTML special characters.
 */
function escapeHtml(unsafe: string): string {
  if (!unsafe || typeof unsafe !== "string") return "";

  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
import { getUserPreferencesSnapshot } from "@/hooks/useUserPreferences";

export type ComposeMode = "new" | "reply" | "reply-all" | "forward";

/**
 * Five blank paragraphs prepended to every composer body so the user lands
 * with breathing room above the quoted block.
 *
 * Each paragraph pins `text-align: left` so the appended reply / forward
 * block never inherits center-alignment from the cursor's prior paragraph.
 */
export const COMPOSER_LEADING_BLANK_LINES_HTML =
  '<p style="text-align: left;"><br></p>'.repeat(5);

/** Strip HTML tags to get plain text. */
export function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function normalizeRichEditorHtml(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (looksLikeHtml(trimmed)) return trimmed;

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => {
      const html = escapeHtml(paragraph.trim()).replace(/\n/g, "<br>");
      return html ? `<p>${html}</p>` : "";
    })
    .filter(Boolean)
    .join("");
}

/** Block-level tags that should produce a line break after their content. */
const BLOCK_TAGS = new Set([
  "p",
  "div",
  "br",
  "tr",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "hr",
  "header",
  "footer",
  "section",
  "article",
]);

function formatEmailDate(value: unknown): string {
  const date = parseEmailDate(value);
  return date ? format(date, "PPpp") : "";
}

/** Convert HTML to plain text using DOM parsing for accurate extraction. */
function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");

  // Remove style, script, and head elements entirely
  doc
    .querySelectorAll("style, script, head, link, meta")
    .forEach((el) => el.remove());

  /** Recursively extract text from a DOM node. */
  function extract(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || "").replace(
        /[\u200B\u200C\u200D\uFEFF\u00AD\u034F]/g,
        "",
      );
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    // Skip hidden elements
    if (tag === "style" || tag === "script") return "";

    // Self-closing block tags
    if (tag === "br") return "\n";
    if (tag === "hr") return "\n---\n";

    // Table cells get a tab separator
    const childText = Array.from(el.childNodes).map(extract).join("");
    if (tag === "td" || tag === "th") return childText + "\t";

    // Block tags get a trailing newline
    if (BLOCK_TAGS.has(tag)) return childText + "\n";

    return childText;
  }

  return (
    extract(doc.body)
      // Collapse runs of whitespace-only lines into max 2 newlines
      .replace(/[ \t]*\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Get clean text body from an email message, converting HTML if needed. */
function getCleanBody(message: EmailMessage): string {
  // Reply/forward quoting has a different precedence from the reading pane:
  // prefer the sender-authored plain MIME alternative whenever it exists, and
  // flatten HTML only as a fallback. The reading pane deliberately prefers an
  // HTML alternative for visual fidelity, so its shared resolver cannot make
  // this reply-specific choice for us.
  if (typeof message.plainBody === "string" && message.plainBody !== "") {
    return message.plainBody;
  }
  if (typeof message.textBody === "string" && message.textBody !== "") {
    return message.textBody;
  }

  const resolved = resolveEmailBody(message);
  return resolved.kind === "html"
    ? htmlToPlainText(resolved.content)
    : resolved.content;
}

/**
 * Join plain-text lines with <br> so the quoted block stays single-spaced
 * regardless of the editor's per-paragraph margin.
 */
function textToHtmlLines(text: string): string {
  return text
    .split("\n")
    .map((line) => escapeHtml(line) || "&nbsp;")
    .join("<br>");
}

/**
 * Build the inner HTML for the quoted/forwarded blockquote.
 *
 * Always renders the original message as PLAIN TEXT inside a single
 * left-aligned paragraph (lines joined with <br>). We deliberately do NOT
 * embed the sender's original HTML: the composer is a Plate editor, not the
 * sandboxed reading-pane iframe, so the email's table layout would survive as
 * nested tables and its <style>/<head> blocks would deserialize into visible
 * raw CSS text. `getCleanBody` strips style/script/head and flattens markup,
 * preferring the message's text part when one exists.
 */
function getQuotedBodyHtml(message: EmailMessage): string {
  const text = getCleanBody(message);
  if (!text.trim()) {
    return "";
  }

  return `<p style="text-align: left;">${textToHtmlLines(text)}</p>`;
}

/** Format quoted text for replies. */
export function formatQuotedText(message: EmailMessage): string {
  const date = formatEmailDate(message.receivedDate ?? message.date);
  const sender = parseSenderName(message);
  const body = getCleanBody(message);

  return `On ${date}, ${sender} wrote:\n${body
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")}`;
}

/** Format forwarded text with headers. */
export function formatForwardedText(message: EmailMessage): string {
  const date = formatEmailDate(message.receivedDate ?? message.date);
  const from = message.from || message.email || "Unknown";
  const to = message.to || "";
  const subject = message.subject || "";
  const body = getCleanBody(message);

  return `---------- Forwarded message ---------
From: ${from}
Date: ${date}
Subject: ${subject}
To: ${to}

${body}`;
}

/** Format quoted HTML for inline reply (Outlook-style). */
export function formatQuotedHtml(message: EmailMessage): string {
  const date = formatEmailDate(message.receivedDate ?? message.date);
  const sender = parseSenderName(message);
  const bodyHtml = getQuotedBodyHtml(message);
  const collapsed = getUserPreferencesSnapshot()
    .composer_quote_collapsed_by_default;
  const collapsedAttr = collapsed ? ' data-collapsed="true"' : "";

  return `${COMPOSER_LEADING_BLANK_LINES_HTML}<hr><p style="text-align: left;">On ${date}, ${sender} wrote:</p><blockquote data-pm-block="quote"${collapsedAttr} style="border-left: 2px solid #b0b0b0; padding-left: 12px; margin-left: 0; color: #555;">${bodyHtml}</blockquote>`;
}

/** Format forwarded HTML with headers for inline forward (Outlook-style). */
export function formatForwardedHtml(message: EmailMessage): string {
  const date = formatEmailDate(message.receivedDate ?? message.date);
  const from = message.from || message.email || "Unknown";
  const to = message.to || "";
  const subject = message.subject || "";
  const bodyHtml = getQuotedBodyHtml(message);
  const collapsed = getUserPreferencesSnapshot()
    .composer_quote_collapsed_by_default;
  const collapsedAttr = collapsed ? ' data-collapsed="true"' : "";

  return `${COMPOSER_LEADING_BLANK_LINES_HTML}<hr><p style="text-align: left;">---------- Forwarded message ---------<br>From: ${escapeHtml(from)}<br>Date: ${date}<br>Subject: ${escapeHtml(subject)}<br>To: ${escapeHtml(to)}</p><blockquote data-pm-block="quote"${collapsedAttr} style="border-left: 2px solid #b0b0b0; padding-left: 12px; margin-left: 0; color: #555;">${bodyHtml}</blockquote>`;
}

/** Get display title for compose mode. */
export function getModeTitle(mode: ComposeMode): string {
  switch (mode) {
    case "reply":
      return __("Replying", "pressedmail");
    case "reply-all":
      return __("Replying", "pressedmail");
    case "forward":
      return __("Forwarding", "pressedmail");
    default:
      return __("New", "pressedmail");
  }
}

/** Format file size to human-readable string. */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
