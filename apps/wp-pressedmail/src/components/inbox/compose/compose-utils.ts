/**
 * Compose Utilities
 *
 * Shared utility functions for the email composer.
 * Extracted from ComposeForm and ComposePane to avoid duplication.
 *
 * @since 2.0.0
 */

import { __, sprintf } from "@wordpress/i18n";
import { getCalendarLocale } from "@/components/calendar/calendar-intl";
import {
  forwardedMessageHeader,
  replyQuoteHeader,
} from "@/lib/composer/quote-headers";
import { parseEmailDate } from "@/lib/email-date";
import { parseSenderName } from "@/lib/mail-utils";
import type { MessageIdentityRef } from "@/lib/message-identity";
import type { EmailAttachment, EmailMessage } from "@/types";
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

/** The date of a quoted message, written the way the user's language does. */
function formatEmailDate(value: unknown): string {
  const date = parseEmailDate(value);
  return date
    ? new Intl.DateTimeFormat(getCalendarLocale(), {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(date)
    : "";
}

/** The From, Date, Subject and To lines of a forwarded message. */
function forwardedHeaderLines(message: EmailMessage): string[] {
  return [
    sprintf(
      /* translators: %s: the sender of a forwarded message. */
      __("From: %s", "pressedmail"),
      message.from || message.email || __("Unknown", "pressedmail"),
    ),
    sprintf(
      /* translators: %s: the date and time a forwarded message arrived. */
      __("Date: %s", "pressedmail"),
      formatEmailDate(message.receivedDate ?? message.date),
    ),
    sprintf(
      /* translators: %s: the subject of a forwarded message. */
      __("Subject: %s", "pressedmail"),
      message.subject || "",
    ),
    sprintf(
      /* translators: %s: the recipients of a forwarded message. */
      __("To: %s", "pressedmail"),
      message.to || "",
    ),
  ];
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

/**
 * Put a reply or forward prefix on a subject that does not carry one yet, in
 * English or in the user's language, whatever its case. Outlook writes "RE:"
 * and "FW:", and a case-sensitive check stacked a new prefix on every round.
 */
function prefixSubject(
  subject: string | null | undefined,
  english: RegExp,
  template: string,
): string {
  const value = subject || "";
  const localized = sprintf(template, "").trim().toLowerCase();
  if (
    english.test(value) ||
    (localized !== "" && value.trim().toLowerCase().startsWith(localized))
  ) {
    return value;
  }
  return sprintf(template, value);
}

/** The subject of a reply to a message with this subject. */
export function replySubject(subject: string | null | undefined): string {
  return prefixSubject(
    subject,
    /^\s*re:/i,
    /* translators: %s: the subject of the message being replied to. */
    __("Re: %s", "pressedmail"),
  );
}

/** The subject of a forward of a message with this subject. */
export function forwardSubject(subject: string | null | undefined): string {
  return prefixSubject(
    subject,
    /^\s*fwd?:/i,
    /* translators: %s: the subject of the message being forwarded. */
    __("Fwd: %s", "pressedmail"),
  );
}

// The two reference lines below ("On ... wrote:" and "Forwarded message")
// come from src/lib/composer/quote-headers.ts. plain-text-content.ts finds the
// quoted original by the same strings, to place the signature and to tell an
// empty reply from a written one. One translation serves both sides.

/** Format quoted text for replies. */
export function formatQuotedText(message: EmailMessage): string {
  const date = formatEmailDate(message.receivedDate ?? message.date);
  const sender = parseSenderName(message);
  const body = getCleanBody(message);

  return `${replyQuoteHeader(date, sender)}\n${body
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")}`;
}

/** Format forwarded text with headers. */
export function formatForwardedText(message: EmailMessage): string {
  const body = getCleanBody(message);

  return `${forwardedMessageHeader()}
${forwardedHeaderLines(message).join("\n")}

${body}`;
}

/**
 * Format quoted HTML for inline reply (Outlook-style).
 *
 * A plain <blockquote>, which Plate's own BlockquotePlugin deserializes. It
 * used to carry data-pm-block="quote" and deserialize into a bespoke node type
 * that had no rules and no transforms: the quote could not be unwrapped with
 * Backspace, the block-type menu would not convert it, and its paragraphs were
 * a depth the drag-handle gate did not cover. The stock blockquote lifts a
 * block out on Backspace-at-start, toggles, and holds real paragraph blocks.
 */
export function formatQuotedHtml(message: EmailMessage): string {
  const date = formatEmailDate(message.receivedDate ?? message.date);
  const sender = parseSenderName(message);
  const bodyHtml = getQuotedBodyHtml(message);

  return `${COMPOSER_LEADING_BLANK_LINES_HTML}<hr><p style="text-align: left;">${escapeHtml(replyQuoteHeader(date, sender))}</p><blockquote style="border-left: 2px solid #b0b0b0; padding-left: 12px; margin-left: 0; color: #555;">${bodyHtml}</blockquote>`;
}

/** Format forwarded HTML with headers for inline forward (Outlook-style). */
export function formatForwardedHtml(message: EmailMessage): string {
  const bodyHtml = getQuotedBodyHtml(message);
  const header = [forwardedMessageHeader(), ...forwardedHeaderLines(message)]
    .map(escapeHtml)
    .join("<br>");

  return `${COMPOSER_LEADING_BLANK_LINES_HTML}<hr><p style="text-align: left;">${header}</p><blockquote style="border-left: 2px solid #b0b0b0; padding-left: 12px; margin-left: 0; color: #555;">${bodyHtml}</blockquote>`;
}

/** The names of the files a forward leaves behind, for the composer to say so. */
export function forwardOmittedAttachmentNames(message: EmailMessage): string[] {
  return (message.attachments ?? [])
    .map((attachment) => String(attachment.filename ?? "").trim())
    .filter((name) => name !== "");
}

/**
 * What a forward starts with: a chip for each of the original's files the
 * server can read back from the mail server, and the names of the files it
 * cannot. `ref` is null when the original has no identity that will still hold
 * at send time (it was just moved out of Trash or Spam): every file is then
 * only named, as before.
 */
export function seedForwardAttachments(
  message: EmailMessage,
  ref: MessageIdentityRef | null,
): { attachments: EmailAttachment[]; forwardOmittedAttachments: string[] } {
  const attachments: EmailAttachment[] = [];
  const kept = new Set<EmailAttachment>();
  if (ref) {
    for (const attachment of message.attachments ?? []) {
      const part =
        typeof attachment.part === "string" ? attachment.part.trim() : "";
      if (part === "") continue;
      kept.add(attachment);
      attachments.push({
        id: `forward-${part}`,
        filename: attachment.filename,
        mimeType: attachment.mimeType ?? attachment.mime ?? "",
        size: attachment.size ?? 0,
        ...(attachment.inline ? { inline: true } : {}),
        ...(attachment.contentId ? { contentId: attachment.contentId } : {}),
        part,
        source: "forward-source",
        forwardSource: {
          accountId: ref.accountId,
          folder: ref.folder,
          uid: Number(ref.uid),
          uidValidity: Number(ref.uidValidity),
          part,
        },
      });
    }
  }
  return {
    attachments,
    forwardOmittedAttachments: forwardOmittedAttachmentNames({
      ...message,
      attachments: (message.attachments ?? []).filter(
        (attachment) => !kept.has(attachment),
      ),
    }),
  };
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
  if (bytes === 0) return __("0 Bytes", "pressedmail");
  if (bytes < 1024) {
    return sprintf(
      /* translators: %s: a file size in bytes. */
      __("%s B", "pressedmail"),
      String(bytes),
    );
  }
  if (bytes < 1024 * 1024) {
    return sprintf(
      /* translators: %s: a file size in kilobytes. */
      __("%s KB", "pressedmail"),
      (bytes / 1024).toFixed(1),
    );
  }
  return sprintf(
    /* translators: %s: a file size in megabytes. */
    __("%s MB", "pressedmail"),
    (bytes / (1024 * 1024)).toFixed(1),
  );
}
