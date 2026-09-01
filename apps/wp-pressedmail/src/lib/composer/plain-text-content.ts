import {
  deserializeLegacyHtmlToPlateValue,
  serializePlateValueToPlainText,
} from "@/components/composer/plate-composer-serialization.active";
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

const QUOTED_REPLY_PATTERN =
  /(?:^|\n{2,})(?=On [^\n]+ wrote:\n(?:> ?[^\n]*(?:\n|$))*)/i;
const FORWARDED_MESSAGE_PATTERN =
  /(?:^|\n{2,})(?=-{5,}[ \t]+Forwarded message[ \t]+-{5,})/i;

function findQuotedOriginalStart(
  text: string,
  mode: PlainTextComposeMode,
): number {
  const reply =
    mode === "reply" || mode === "reply-all"
      ? QUOTED_REPLY_PATTERN.exec(text)?.index
      : undefined;
  const forwarded =
    mode === "forward"
      ? FORWARDED_MESSAGE_PATTERN.exec(text)?.index
      : undefined;

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

function stripPlainSignature(text: string, mode: PlainTextComposeMode): string {
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
