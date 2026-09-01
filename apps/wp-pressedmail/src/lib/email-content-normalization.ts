import DOMPurify from "dompurify";

export const EMAIL_PREVIEW_FALLBACK = "\u00A0";

export type BodySource = {
  htmlBody?: string | null;
  body?: string | null;
  textBody?: string | null;
  text?: string | null;
  plainBody?: string | null;
  contentType?: "html" | "plain" | null;
  content_type?: "html" | "plain" | null;
};

export type ResolvedEmailBody = {
  kind: "html" | "plain";
  content: string;
  source: "htmlBody" | "plainBody" | "textBody" | "body" | "text" | "none";
};

const MSO_CONDITIONAL_BLOCK = /<!--\s*\[if[\s\S]*?<!\s*\[endif\]\s*-->/gi;
const MSO_OPEN_COMMENT = /<!--\s*\[if[^\]]*\]\s*>/gi;
const MSO_END_COMMENT = /<!\s*\[endif\]\s*-->/gi;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const HTML_COMMENT_OPEN_ARTIFACT = /<!--[^\r\n]*/g;
const HTML_COMMENT_CLOSE_ARTIFACT = /-->/g;
const HTML_TAG_PATTERN =
  /<!doctype\b|<\s*(html|head|body|table|thead|tbody|tfoot|tr|td|th|div|p|span|a|img|br|style|link|center|font|ul|ol|li|blockquote|h[1-6])\b/i;
// Any tag-like construct, including non-standard markup (Office <o:p>, VML
// <v:rect>, MJML <mj-section>, bare <mark>/<font>, custom elements) that the
// allowlist above intentionally omits. Used to decide whether the PREVIEW path
// must run full tag-stripping; requires a letter right after `<` so plain-text
// math like "5 < 10" is not mistaken for markup.
const GENERIC_TAG_PATTERN = /<\/?[a-zA-Z][a-zA-Z0-9:-]*(?:\s[^>]*)?>/;
const CSS_BLOCK_PATTERN =
  /(?:@(?:media|supports)[^{]*\{[\s\S]*?\}\s*\}|@(?:font-face|keyframes)[^{]*\{[\s\S]*?\}|[.#]?[a-zA-Z_][\w:.\-#,\s>+~*="'()[\]]*\s*\{[^{}]*\})/g;
const CSS_DECLARATION_PATTERN =
  /\b(?:background|border|color|display|font|height|line-height|margin|mso|padding|text-align|vertical-align|width)[\w-]*\s*:\s*[^;{}]+;?/gi;

export function stripEmailConditionalComments(value: string): string {
  return value
    .replace(MSO_CONDITIONAL_BLOCK, " ")
    .replace(MSO_OPEN_COMMENT, " ")
    .replace(MSO_END_COMMENT, " ")
    .replace(HTML_COMMENT, " ")
    .replace(HTML_COMMENT_OPEN_ARTIFACT, " ")
    .replace(HTML_COMMENT_CLOSE_ARTIFACT, " ");
}

export function decodeQuotedPrintable(value: string): string {
  if (!value) return "";

  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([A-Fa-f0-9]{2})/g, (_match, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

function extractMimeBody(value: string): string {
  const parts = value.split(/\r?\n\s*\r?\n/);
  return parts.length > 1 ? parts.slice(1).join("\n\n") : value;
}

// Recognized RFC822 header names whose presence as a LONE leading line marks a
// leaked header (vs ordinary body copy). Keep byte-identical with the PHP twin
// EmailHtmlSanitizer::RECOGNIZED_RFC822_HEADERS, any change here must mirror
// there. Any `x-*` header also counts (handled in isRecognizedHeaderName).
const RECOGNIZED_RFC822_HEADERS = new Set([
  "subject",
  "from",
  "to",
  "cc",
  "bcc",
  "date",
  "reply-to",
  "sender",
  "message-id",
  "in-reply-to",
  "references",
  "content-type",
  "content-transfer-encoding",
  "content-disposition",
  "mime-version",
  "return-path",
  "received",
  "delivered-to",
  "authentication-results",
  "dkim-signature",
]);

function isRecognizedHeaderName(name: string): boolean {
  const lower = name.toLowerCase();
  return RECOGNIZED_RFC822_HEADERS.has(lower) || lower.startsWith("x-");
}

// Strip a leaked RFC822/MIME header block (Subject:/From:/Content-Type: ...)
// that bled into a body. Fires when the value opens with two or more well-formed
// "Header-Name: value" lines, OR with a single such line whose name is a
// recognized RFC822 header, so a body that merely starts with one ordinary
// "Word: ..." line (e.g. "Note:"/"Warning:") is left untouched, while a lone
// leaked "Subject:"/"X-...:" line is removed.
// Assumes CRLF has already been normalized to LF.
function stripLeadingMimeHeaders(value: string): string {
  let head = value.replace(/^\s+/, "");
  // Drop a leading MIME multipart boundary delimiter ("--==_Part_0") only when
  // it is immediately followed by a header line, mirrors the PHP twin and
  // leaves ordinary text / "-- " signature delimiters untouched.
  const boundary = head.match(/^--\S[^\n]*\n/);
  if (boundary) {
    const after = head.slice(boundary[0].length).replace(/^\n+/, "");
    if (/^[A-Za-z][A-Za-z0-9-]*:[ \t]/.test(after)) {
      head = after;
      value = after;
    }
  }
  if (!/^[A-Za-z][A-Za-z0-9-]*:[ \t]/.test(head)) return value;
  const sep = head.match(/\n[ \t]*\n/);
  if (!sep || sep.index === undefined) return value;
  const headerBlock = head.slice(0, sep.index);
  const rest = head.slice(sep.index + sep[0].length);
  let headerLike = 0;
  const headerNames: string[] = [];
  for (const line of headerBlock.split("\n")) {
    if (line === "") continue;
    if (/^[ \t]/.test(line)) continue; // folded continuation
    const match = line.match(/^([A-Za-z][A-Za-z0-9-]*):/);
    if (!match) return value;
    headerNames.push(match[1]!);
    headerLike++;
  }
  if (headerLike === 0) return value;
  // A lone leading header line is only a leaked RFC822 header when its name is
  // recognized; otherwise it is ordinary body copy and must be preserved.
  if (headerLike === 1 && !isRecognizedHeaderName(headerNames[0]!))
    return value;
  return rest.replace(/^\s+/, "");
}

export function decodeHtmlEntities(value: string): string {
  if (!value) return "";

  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value || textarea.textContent || "";
  }

  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_match, dec: string) =>
      String.fromCharCode(parseInt(dec, 10)),
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function normalizeEmailBodySource(value: string): string {
  if (!value) return "";

  const original = value;
  let body = value.replace(/\r\n/g, "\n");
  body = stripLeadingMimeHeaders(body);
  const hasMimeHeaders =
    /Content-Type\s*:/i.test(body) ||
    /Content-Transfer-Encoding\s*:/i.test(body);

  if (hasMimeHeaders) {
    body = extractMimeBody(body);
  }

  if (
    /Content-Transfer-Encoding\s*:\s*quoted-printable/i.test(original) ||
    /=([A-Fa-f0-9]{2})/.test(body)
  ) {
    body = decodeQuotedPrintable(body);
  }

  return stripEmailConditionalComments(body).trim();
}

export function looksLikeEmailHtml(value: string): boolean {
  if (!value) return false;

  return (
    /<!--\s*\[if/i.test(value) ||
    HTML_TAG_PATTERN.test(value) ||
    HTML_TAG_PATTERN.test(normalizeEmailBodySource(value))
  );
}

function stripHtmlBlocks(value: string): string {
  return value
    .replace(
      /<\s*(script|style|head|meta|link|title)\b[\s\S]*?(?:<\s*\/\s*\1\s*>|>)/gi,
      " ",
    )
    .replace(/<\s*\/?\s*(script|style|head|meta|link|title)\b[^>]*>/gi, " ");
}

function htmlToText(value: string): string {
  let source = stripHtmlBlocks(stripEmailConditionalComments(value));

  if (
    typeof DOMPurify?.sanitize === "function" &&
    typeof document !== "undefined"
  ) {
    source = DOMPurify.sanitize(source, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    }) as unknown as string;
  } else {
    source = source.replace(/<[^>]+>/g, " ");
  }

  return decodeHtmlEntities(source);
}

function removeCssSyntax(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(CSS_BLOCK_PATTERN, " ")
    .replace(CSS_DECLARATION_PATTERN, " ");
}

function cleanPlainPreview(value: string): string {
  return removeCssSyntax(value)
    .replace(/[\u200B\u200C\u200D\u200E\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\((https?:\/\/[^\s)]+)\)/gi, " ")
    .replace(/\bhttps?:\/\/[^\s]+/gi, " ")
    .replace(/\bwww\.[^\s]+/gi, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\(/g, "$1")
    .replace(/\[([^\]]*)\]/g, "$1")
    .replace(/\s*\(\s*\)\s*/g, " ")
    .replace(/\s*\[\s*\]\s*/g, " ")
    .replace(/\s*\{\s*\}\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toEmailPreviewText(
  value: string | null | undefined,
  maxLength = 120,
): string {
  if (!value) return "";

  const normalized = normalizeEmailBodySource(value);
  // Strip tags whenever ANY markup is present, not only the allowlisted email
  // tags. Non-standard markup (o:p, VML, MJML, bare <mark>) must never reach the
  // plain-text preview verbatim.
  const hasMarkup =
    looksLikeEmailHtml(value) ||
    GENERIC_TAG_PATTERN.test(value) ||
    GENERIC_TAG_PATTERN.test(normalized);
  const text = hasMarkup
    ? htmlToText(normalized)
    : decodeHtmlEntities(stripEmailConditionalComments(normalized));
  const cleaned = cleanPlainPreview(text);

  if (!cleaned) return "";
  return cleaned.length > maxLength
    ? `${cleaned.slice(0, maxLength)}...`
    : cleaned;
}

export function buildEmailPreviewText(
  candidates: Array<string | null | undefined>,
  maxLength = 120,
  fallback = EMAIL_PREVIEW_FALLBACK,
): string {
  for (const candidate of candidates) {
    const preview = toEmailPreviewText(candidate, maxLength);
    if (preview) return preview;
  }

  return fallback;
}

export function getReadableMessagePreview(
  source: BodySource & { snippet?: string | null },
  maxLength = 140,
): string {
  return buildEmailPreviewText(
    [
      source.snippet,
      source.textBody,
      source.plainBody,
      source.text,
      source.body,
      source.htmlBody,
    ],
    maxLength,
    "",
  );
}

function explicitContentType(source: BodySource): "html" | "plain" | null {
  const value = source.contentType ?? source.content_type;
  return value === "html" || value === "plain" ? value : null;
}

/**
 * Resolve a structured message body without allowing a legacy summary/body
 * field to override the MIME alternatives returned by the detail endpoint.
 * Explicit plain-text parts are deliberately returned byte-for-byte: callers
 * render them as text children, never as markup.
 */
export function resolveEmailBody(source: BodySource): ResolvedEmailBody {
  const mimeType = explicitContentType(source);
  const htmlBody = typeof source.htmlBody === "string" ? source.htmlBody : null;
  const plainBody =
    typeof source.plainBody === "string" ? source.plainBody : null;
  const textBody = typeof source.textBody === "string" ? source.textBody : null;

  if (htmlBody !== null && htmlBody.trim() !== "") {
    return {
      kind: "html",
      content: normalizeEmailBodySource(htmlBody),
      source: "htmlBody",
    };
  }

  if (plainBody !== null && plainBody !== "") {
    return { kind: "plain", content: plainBody, source: "plainBody" };
  }

  if (textBody !== null && textBody !== "") {
    return { kind: "plain", content: textBody, source: "textBody" };
  }

  // An explicitly typed empty plain part is authoritative. Without an
  // explicit MIME type, however, an empty alternate must not hide a useful
  // legacy body.
  if (mimeType === "plain" && (plainBody !== null || textBody !== null)) {
    return {
      kind: "plain",
      content: plainBody ?? textBody ?? "",
      source: plainBody !== null ? "plainBody" : "textBody",
    };
  }

  if (typeof source.body === "string") {
    if (mimeType === "plain") {
      return { kind: "plain", content: source.body, source: "body" };
    }

    if (mimeType === "html" || looksLikeEmailHtml(source.body)) {
      return {
        kind: "html",
        content: normalizeEmailBodySource(source.body),
        source: "body",
      };
    }

    return {
      kind: "plain",
      // Generic `body` is a legacy field, so keep its historical cleanup of
      // leaked MIME headers. Explicit MIME text above is never normalized.
      content: normalizeEmailBodySource(source.body),
      source: "body",
    };
  }

  // Some legacy non-reader callers still supply `text`. It is a final plain
  // fallback here, but MailDisplay intentionally does not pass the list-row
  // `mail.text` snippet into this resolver or loaded-body evidence.
  if (typeof source.text === "string" && source.text !== "") {
    return {
      kind: "plain",
      content: decodeHtmlEntities(normalizeEmailBodySource(source.text)),
      source: "text",
    };
  }

  return { kind: mimeType ?? "plain", content: "", source: "none" };
}

export function prepareEmailBodyForDisplay(source: BodySource): {
  body: string;
  isHtml: boolean;
} {
  const resolved = resolveEmailBody(source);

  return {
    body: resolved.content,
    isHtml: resolved.kind === "html",
  };
}
