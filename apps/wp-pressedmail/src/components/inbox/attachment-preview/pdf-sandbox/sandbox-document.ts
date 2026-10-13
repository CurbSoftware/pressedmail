/**
 * The document that goes inside the sandboxed frame.
 *
 * It exists in two shapes that must stay the same policy. This one is a srcdoc: the page fetches the two glue scripts
 * as text, hashes them, and inlines them under a CSP that allows that one hash. The other is the static
 * `assets/pdf-viewer/viewer.html`, which loads the same scripts by URL under `script-src 'self'`. The page uses the
 * second when a CSP on the admin page stops a srcdoc from running (a srcdoc inherits the page's policy and a URL
 * document does not), or when the browser cannot hash (SubtleCrypto needs a secure context).
 * `sandbox-document.test.ts` fails if viewer.html drifts from the constants below.
 *
 * What the CSP does: with the sandbox alone a hostile script cannot read the page, but it could still send what it
 * holds anywhere. connect-src, img-src, form-action and the rest close that, and the tests prove a canary server sees
 * nothing. 'wasm-unsafe-eval' is needed because pdf.js compiles wasm (JBIG2, JPEG 2000) and PostScript functions.
 */

/** Everything but script-src, which differs between the two shapes. */
const CSP_REST =
  "worker-src blob: data:; style-src 'unsafe-inline'; img-src blob: data:; font-src blob: data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; object-src 'none'";

export function sandboxCsp(scriptSource: string): string {
  return `default-src 'none'; script-src ${scriptSource} blob: 'wasm-unsafe-eval'; ${CSP_REST}`;
}

/** Page boxes stack and centre, and a page wider than the frame scrolls from its left edge. */
export const SANDBOX_CSS =
  "html,body{margin:0;height:100%;background:#525659}#sc{height:100%;overflow:auto}.pm-pages{display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:12px;width:max-content;min-width:100%;box-sizing:border-box}.pm-page{background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.4);position:relative;flex:none;margin:0 auto}.pm-page canvas{display:block}.pm-page[data-error]{display:flex;align-items:center;justify-content:center;color:#444;font:14px sans-serif;text-align:center}";

/**
 * Line endings as the HTML parser will see them. A CSP hash covers the script text after parsing, and the parser turns
 * CRLF into LF, so a file served with Windows line endings would otherwise never match its own hash.
 */
export function normalizeScript(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/** `'sha256-...'` for a script's text, or null where the browser has no SubtleCrypto (a plain-http admin). */
export async function scriptHash(text: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = new Uint8Array(
    await subtle.digest("SHA-256", new TextEncoder().encode(text)),
  );
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return `'sha256-${btoa(binary)}'`;
}

/** Text that would change how the HTML parser reads an inline script: it could end it early or hide the rest. */
const UNSAFE_INLINE = /<\/script|<script|<!--/i;

/**
 * The srcdoc for the frame, or null when it cannot be built safely. `scripts` are the glue files in load order.
 * Their text is inlined verbatim, so a file that holds any of the sequences above is refused rather than escaped.
 */
export async function buildSrcdoc(
  scripts: readonly string[],
  hash: (text: string) => Promise<string | null> = scriptHash,
): Promise<string | null> {
  const script = normalizeScript(scripts.join("\n;\n"));
  if (UNSAFE_INLINE.test(script)) return null;
  const source = await hash(script);
  if (!source) return null;
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${sandboxCsp(source)}">` +
    `<style>${SANDBOX_CSS}</style></head>` +
    `<body><div id="sc" tabindex="0"></div><script>${script}</script></body></html>`
  );
}
