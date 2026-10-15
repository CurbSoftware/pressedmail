/**
 * The `{{path}}` and `{{path|fallback}}` merge-field grammar, read the way the
 * server reads it (`TemplateVariables::PATTERN` in plugin-files/includes/Services/Templates).
 *
 * It lives in lib, not in components/templates, because the Insert button is a
 * Free feature and checks a field too, and Free does not ship the templates
 * code. components/templates/template-fields.ts re-exports it for the editor.
 */

/** The ten namespaces the server fills or blanks. Anything else is the author's own text. `post` is filled inside a posts block (Pro). */
export const TEMPLATE_NAMESPACES = [
  "contact",
  "sender",
  "site",
  "user",
  "list",
  "campaign",
  "link",
  "event",
  "date",
  "post",
] as const;

const NAMESPACES: ReadonlySet<string> = new Set(TEMPLATE_NAMESPACES);

/** Longest field key, and longest fallback the server reads, as written in the pattern. */
const KEY_MAX = 32;
export const FALLBACK_SCAN_MAX = 600;

/** Longest fallback the editor offers, in characters of text. The server reads up to 600 of stored HTML. */
export const TEMPLATE_FALLBACK_MAX = 100;

/** Most text the scan reads. The server refuses a scan past twice the body cap; the editor stops earlier. */
const SCAN_MAX = 2 * 1024 * 1024;

export interface TemplateToken {
  /** Offset of the first `{` in the text scanned. */
  start: number;
  /** Offset just past the last `}`. */
  end: number;
  /** `namespace.key`. */
  path: string;
  /** Trimmed, as the server reads it. Empty when the token has none. */
  fallback: string;
}

const isSpace = (char: string | undefined): boolean => char !== undefined && /\s/.test(char);
const isLower = (char: string | undefined): boolean => char !== undefined && char >= "a" && char <= "z";
const isKeyChar = (char: string | undefined): boolean =>
  char !== undefined && (isLower(char) || (char >= "0" && char <= "9") || char === "_");
const isFallbackChar = (char: string | undefined): boolean =>
  char !== undefined && !"{}|<>\r\n".includes(char);

function skipSpace(text: string, from: number): number {
  let at = from;
  while (isSpace(text[at])) at += 1;
  return at;
}

/** One token that starts at `start` (the first `{`), or null when the text there is not one. */
function readToken(text: string, start: number): TemplateToken | null {
  let at = skipSpace(text, start + 2);

  const spaceName = at;
  while (isLower(text[at])) at += 1;
  const namespace = text.slice(spaceName, at);
  if (!NAMESPACES.has(namespace) || text[at] !== ".") return null;
  at += 1;

  const keyStart = at;
  if (!isLower(text[at])) return null;
  while (isKeyChar(text[at]) && at - keyStart < KEY_MAX) at += 1;
  // A thirty-third key character is not a token, like the server's possessive quantifier.
  if (isKeyChar(text[at])) return null;
  const path = `${namespace}.${text.slice(keyStart, at)}`;

  at = skipSpace(text, at);
  let fallback = "";
  if (text[at] === "|") {
    at += 1;
    const fallbackStart = at;
    while (isFallbackChar(text[at]) && at - fallbackStart < FALLBACK_SCAN_MAX) at += 1;
    fallback = text.slice(fallbackStart, at).trim();
    at = skipSpace(text, at);
  }
  if (text[at] !== "}" || text[at + 1] !== "}") return null;
  return { start, end: at + 2, path, fallback };
}

/** Every token in the text, in order. Text past the scan limit is not read. */
export function scanTemplateTokens(text: string): TemplateToken[] {
  const source = text.length > SCAN_MAX ? text.slice(0, SCAN_MAX) : text;
  const tokens: TemplateToken[] = [];
  let open = source.indexOf("{{");
  while (open !== -1) {
    const token = readToken(source, open);
    if (token) {
      tokens.push(token);
      open = source.indexOf("{{", token.end);
    } else {
      open = source.indexOf("{{", open + 1);
    }
  }
  return tokens;
}

/** Whether the text is one field and nothing else, such as the address of a link a credential is set to. */
export function isTemplateToken(text: string): boolean {
  const trimmed = text.trim();
  const [token, ...rest] = scanTemplateTokens(trimmed);
  return token !== undefined && rest.length === 0 && token.start === 0 && token.end === trimmed.length;
}
