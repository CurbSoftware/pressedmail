import { __ } from "@wordpress/i18n";

import {
  deserializeLegacyHtmlToPlateValue,
  serializePlateValueToPlainText,
} from "@/components/composer/plate-composer-serialization.active";
import { replyQuoteHeader } from "@/lib/composer/quote-headers";
import type { SignatureContentType } from "@/types/signatures";

type PlainTextComposeMode = "new" | "reply" | "reply-all" | "forward";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Keep an RFC text body literal while making newline/UTF-8 storage stable. */
export function normalizeOutgoingPlainText(text: string): string {
  return text.split("\u0000").join("").replace(/\r\n?/g, "\n");
}

/** Convert literal text into safe, editable composer HTML. */
export function plainTextToComposerHtml(text: string): string {
  const normalized = normalizeOutgoingPlainText(text);
  if (!normalized) return "";

  return normalized
    .split(/\n{2,}/)
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

/** Use the same supported-node semantics as rich-to-plain mode switching. */
export function composerHtmlToPlainText(html: string): string {
  if (!html) return "";
  return serializePlateValueToPlainText(
    deserializeLegacyHtmlToPlateValue(html),
  );
}

const SIGNATURE_SOFT_BREAK_MARKER = "\uFDD0pressedmail-br\uFDD1";

function signatureHtmlToPlainText(html: string): string {
  const protectedSoftBreaks = html.replace(
    /<br\b[^>]*>/gi,
    SIGNATURE_SOFT_BREAK_MARKER,
  );
  return composerHtmlToPlainText(protectedSoftBreaks)
    .split(SIGNATURE_SOFT_BREAK_MARKER)
    .join("\n");
}

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * English always, because mail quoted before these lines were translated, or
 * by a correspondent writing in English, has to be found too. The user's
 * language is added beside it.
 */
const ENGLISH_REPLY_LINE = "On [^\\n]+ wrote:";
const ENGLISH_FORWARD_WORDS = "Forwarded message";

let quotePatterns: {
  replyLine: string;
  forwardWords: string;
  reply: RegExp;
  forwarded: RegExp;
} | null = null;

function getQuotePatterns() {
  // Marker characters stand in for the date and the sender, so the rest of
  // the translated line can be escaped whatever it contains.
  const replyLine = replyQuoteHeader("\uFDD2", "\uFDD2");
  const forwardWords = __("Forwarded message", "pressedmail");
  if (
    quotePatterns?.replyLine === replyLine &&
    quotePatterns.forwardWords === forwardWords
  ) {
    return quotePatterns;
  }
  const replyLines = [ENGLISH_REPLY_LINE];
  // A translation with no words of its own would match any line: skip it.
  if (/\p{L}/u.test(replyLine)) {
    replyLines.push(
      replyLine.split("\uFDD2").map(escapeRegExp).join("[^\\n]+"),
    );
  }
  const forwardWordsPattern = [
    ENGLISH_FORWARD_WORDS,
    escapeRegExp(forwardWords),
  ].join("|");
  quotePatterns = {
    replyLine,
    forwardWords,
    reply: new RegExp(`(?:^|\\n{2,})(?=(?:${replyLines.join("|")})\\n)`, "iu"),
    forwarded: new RegExp(
      `(?:^|\\n{2,})(?=-{5,}[ \\t]+(?:${forwardWordsPattern})[ \\t]+-{5,})`,
      "iu",
    ),
  };
  return quotePatterns;
}

function findQuotedOriginalStart(
  text: string,
  mode: PlainTextComposeMode,
): number {
  const patterns = getQuotePatterns();
  const reply =
    mode === "reply" || mode === "reply-all"
      ? patterns.reply.exec(text)?.index
      : undefined;
  const forwarded =
    mode === "forward" ? patterns.forwarded.exec(text)?.index : undefined;

  if (reply === undefined) return forwarded ?? text.length;
  if (forwarded === undefined) return reply;
  return Math.min(reply, forwarded);
}

/** Return only text the author added above generated reply/forward content. */
export function getPlainTextAuthoredContent(
  body: string,
  mode: PlainTextComposeMode,
): string {
  const normalized = normalizeOutgoingPlainText(body);
  const quoteStart = findQuotedOriginalStart(normalized, mode);
  const authored = normalized.slice(0, quoteStart);
  const signature = /(?:^|\n{2,})--[ \t]*\n/.exec(authored);
  const withoutSignature = signature
    ? authored.slice(0, signature.index)
    : authored;
  return withoutSignature.trim();
}

export function stripPlainSignature(
  text: string,
  mode: PlainTextComposeMode,
): string {
  const quoteStart = findQuotedOriginalStart(text, mode);
  const authored = text.slice(0, quoteStart);
  const quoted = text.slice(quoteStart);
  const separator = /(?:^|\n{2,})--[ \t]*\n/;
  const match = separator.exec(authored);

  if (!match) return text;

  return `${authored.slice(0, match.index).replace(/\s+$/g, "")}${
    quoted ? `\n\n${quoted.replace(/^\n+/, "")}` : ""
  }`;
}

export function plainTextSignatureSnapshot(
  text: string,
  mode: PlainTextComposeMode,
): string | null {
  const normalized = normalizeOutgoingPlainText(text);
  const authored = normalized.slice(
    0,
    findQuotedOriginalStart(normalized, mode),
  );
  const match = /(?:^|\n{2,})--[ \t]*\n/.exec(authored);
  return match ? authored.slice(match.index).trim() : null;
}

export function hasPlainTextSignature(
  text: string,
  mode: PlainTextComposeMode,
): boolean {
  const normalized = normalizeOutgoingPlainText(text);
  const authored = normalized.slice(
    0,
    findQuotedOriginalStart(normalized, mode),
  );
  return /(?:^|\n{2,})--[ \t]*\n/.test(authored);
}

export function applyPlainTextSignature(
  body: string,
  signature: { content: string; content_type: SignatureContentType },
  mode: PlainTextComposeMode,
): string {
  const normalizedBody = stripPlainSignature(
    normalizeOutgoingPlainText(body),
    mode,
  );
  const rawSignature =
    signature.content_type === "html"
      ? signatureHtmlToPlainText(signature.content)
      : normalizeOutgoingPlainText(signature.content);
  const signatureText = rawSignature
    .replace(/^\n+/, "")
    .replace(/^--[ \t]*(?:\n|$)/, "")
    .replace(/^\n+|\n+$/g, "");

  if (!signatureText) return normalizedBody;
  const quoteStart = findQuotedOriginalStart(normalizedBody, mode);
  const authored = normalizedBody.slice(0, quoteStart).replace(/\s+$/g, "");
  const quoted = normalizedBody.slice(quoteStart).replace(/^\n+/, "");
  const signatureBlock = `-- \n${signatureText}`;

  return [authored, signatureBlock, quoted].filter(Boolean).join("\n\n");
}
