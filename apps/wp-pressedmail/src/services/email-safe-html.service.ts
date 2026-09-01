import { sanitizeComposerFontFamily } from "@/lib/font-registry";
import { normalizeComposerBackgroundColor } from "@/lib/composer-background-color";

const DEFAULT_BACKGROUND = "#ffffff";
const DEFAULT_TEXT = "#111827";
const DEFAULT_MUTED_TEXT = "#4b5563";
const DEFAULT_BORDER = "#d1d5db";
const DEFAULT_HEADER_BACKGROUND = "#f3f4f6";
const DEFAULT_LINK = "#2563eb";

type StyleDeclaration = {
  prop: string;
  value: string;
};

export interface PrepareEmailHtmlOptions {
  bodyBackgroundColor?: string;
}

export function normalizeEmailBodyBackgroundColor(
  value?: string,
): string | undefined {
  return normalizeComposerBackgroundColor(value);
}

function parseStyle(style: string | null): StyleDeclaration[] {
  if (!style) return [];

  return style
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf(":");
      if (separator === -1) return null;

      return {
        prop: entry.slice(0, separator).trim(),
        value: entry.slice(separator + 1).trim(),
      };
    })
    .filter((entry): entry is StyleDeclaration => Boolean(entry));
}

function isThemeDependentStyle(value: string | undefined): boolean {
  return Boolean(value && /var\(|oklch\(/i.test(value));
}

function mergeStyle(
  current: string | null,
  defaults: Record<string, string>,
): string {
  const declarations = parseStyle(current);

  for (const [prop, value] of Object.entries(defaults)) {
    const existing = declarations.find(
      (declaration) => declaration.prop.toLowerCase() === prop.toLowerCase(),
    );

    if (!existing) {
      declarations.push({ prop, value });
      continue;
    }

    if (isThemeDependentStyle(existing.value)) {
      existing.value = value;
    }
  }

  return declarations
    .map((declaration) => `${declaration.prop}: ${declaration.value};`)
    .join(" ");
}

function serializeStyle(declarations: StyleDeclaration[]): string {
  return declarations
    .map((declaration) => `${declaration.prop}: ${declaration.value};`)
    .join(" ");
}

// Live-editor-only chrome that must never reach the recipient: the "Signature"
// badge and the quote "from" header. Current content carries the
// data-pm-decoration marker; the class selectors also strip content captured
// during the old DOM-fallback serialization bug (which baked the label in as
// real text without the marker).
const EDITOR_DECORATION_SELECTOR =
  "[data-pm-decoration], .pm-signature-label, .pm-quote-header";

function stripEditorDecorations(root: HTMLElement): void {
  root
    .querySelectorAll<HTMLElement>(EDITOR_DECORATION_SELECTOR)
    .forEach((element) => element.remove());
}

function sanitizeInlineFontFamilies(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const declarations = parseStyle(element.getAttribute("style"));
    let changed = false;
    const sanitized = declarations.flatMap((declaration) => {
      if (declaration.prop.toLowerCase() !== "font-family") {
        return [declaration];
      }

      changed = true;
      const fontFamily = sanitizeComposerFontFamily(declaration.value);
      return fontFamily ? [{ prop: declaration.prop, value: fontFamily }] : [];
    });

    if (!changed) return;

    const nextStyle = serializeStyle(sanitized);
    if (nextStyle) {
      element.setAttribute("style", nextStyle);
    } else {
      element.removeAttribute("style");
    }
  });
}

function applyDefaultStyles(
  root: HTMLElement,
  selector: string,
  styles: Record<string, string>,
): void {
  root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    element.setAttribute(
      "style",
      mergeStyle(element.getAttribute("style"), styles),
    );
  });
}

function buildWrapperHtml(content: string, background: string): string {
  return `<div data-pm-email-body="true" style="background-color: ${background}; color: ${DEFAULT_TEXT};">${content}</div>`;
}

export interface UnwrappedEmailBody {
  html: string;
  bodyBackgroundColor?: string;
}

/** The sole top-level element, when there is exactly one and nothing else. */
function onlyElementChild(root: HTMLElement): HTMLElement | null {
  const meaningful = Array.from(root.childNodes).filter(
    (node) =>
      node.nodeType !== Node.TEXT_NODE || (node.textContent ?? "").trim() !== "",
  );
  const [first] = meaningful;
  return meaningful.length === 1 && first instanceof HTMLElement ? first : null;
}

/**
 * Take the send/draft wrapper back off a stored body.
 *
 * Both wrappers are write-only today: nothing removes them, so the composer
 * reloads its own output. Plate has no element rule for a bare div, so the
 * wrapper falls through to a leaf and its inline color/background get smeared
 * onto every text node, then a fresh wrapper goes on top of that. Peel every
 * layer (earlier cycles can leave them nested) and hand back the background so
 * the caller can keep it, since nothing else persists that colour.
 */
export function unwrapEmailBodyHtml(html: string): UnwrappedEmailBody {
  if (typeof document === "undefined" || !html) {
    return { html };
  }

  const template = document.createElement("template");
  template.innerHTML = html;
  const root = document.createElement("div");
  root.append(template.content.cloneNode(true));

  let bodyBackgroundColor: string | undefined;
  for (;;) {
    const wrapper = onlyElementChild(root);
    if (!wrapper) break;

    // data-pm-body-background is written only for a deliberate choice, so its
    // value is authoritative. The send wrapper always carries a background, so
    // plain white there means "none set" rather than a colour the user picked.
    const declared = wrapper.getAttribute("data-pm-body-background");
    if (declared !== null) {
      bodyBackgroundColor ??= normalizeEmailBodyBackgroundColor(declared);
    } else if (wrapper.getAttribute("data-pm-email-body") !== null) {
      // Read the raw attribute, not the CSSOM: browsers rewrite hex to rgb()
      // and refuse eight-digit values outright, so both would be lost here.
      const sent = normalizeEmailBodyBackgroundColor(
        parseStyle(wrapper.getAttribute("style")).find(
          (declaration) =>
            declaration.prop.toLowerCase() === "background-color",
        )?.value,
      );
      bodyBackgroundColor ??= sent === DEFAULT_BACKGROUND ? undefined : sent;
    } else {
      break;
    }

    root.replaceChildren(...Array.from(wrapper.childNodes));
  }

  return { html: root.innerHTML, bodyBackgroundColor };
}

export function prepareEmailHtmlForSend(
  html: string,
  options: PrepareEmailHtmlOptions = {},
): string {
  // Re-preparing an already-prepared body is normal: the serializer cache can
  // be cold, so `getHTML() || body` hands back the stored, wrapped HTML. Take
  // the old wrapper off first or they nest, one layer per save.
  const unwrapped = unwrapEmailBodyHtml(html);
  const background =
    normalizeEmailBodyBackgroundColor(options.bodyBackgroundColor) ??
    unwrapped.bodyBackgroundColor ??
    DEFAULT_BACKGROUND;

  if (typeof document === "undefined") {
    return buildWrapperHtml(unwrapped.html, background);
  }

  const template = document.createElement("template");
  template.innerHTML = unwrapped.html;
  const root = document.createElement("div");
  root.append(template.content.cloneNode(true));

  stripEditorDecorations(root);
  sanitizeInlineFontFamilies(root);

  applyDefaultStyles(root, "p", {
    color: DEFAULT_TEXT,
    "line-height": "1.5",
    margin: "0 0 12px",
  });
  applyDefaultStyles(root, "h1", {
    color: DEFAULT_TEXT,
    "font-size": "28px",
    "line-height": "1.2",
    margin: "0 0 14px",
  });
  applyDefaultStyles(root, "h2", {
    color: DEFAULT_TEXT,
    "font-size": "22px",
    "line-height": "1.25",
    margin: "0 0 12px",
  });
  applyDefaultStyles(root, "h3", {
    color: DEFAULT_TEXT,
    "font-size": "18px",
    "line-height": "1.3",
    margin: "0 0 10px",
  });
  applyDefaultStyles(root, "ul, ol", {
    color: DEFAULT_TEXT,
    margin: "0 0 12px",
    "padding-left": "24px",
  });
  applyDefaultStyles(root, "li", {
    color: DEFAULT_TEXT,
    "line-height": "1.5",
  });
  applyDefaultStyles(root, "blockquote", {
    color: DEFAULT_MUTED_TEXT,
    "border-left": `3px solid ${DEFAULT_BORDER}`,
    margin: "12px 0",
    "padding-left": "12px",
  });
  applyDefaultStyles(root, "hr", {
    border: "0",
    "border-top": `1px solid ${DEFAULT_BORDER}`,
    margin: "16px 0",
  });
  applyDefaultStyles(root, "a", {
    color: DEFAULT_LINK,
    "text-decoration": "underline",
  });
  applyDefaultStyles(root, "table", {
    "border-collapse": "collapse",
    color: DEFAULT_TEXT,
  });
  root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    if (!table.getAttribute("cellpadding"))
      table.setAttribute("cellpadding", "0");
    if (!table.getAttribute("cellspacing"))
      table.setAttribute("cellspacing", "0");
  });
  applyDefaultStyles(root, "td", {
    color: DEFAULT_TEXT,
    border: `1px solid ${DEFAULT_BORDER}`,
    padding: "8px",
    "vertical-align": "top",
  });
  applyDefaultStyles(root, "th", {
    color: DEFAULT_TEXT,
    "background-color": DEFAULT_HEADER_BACKGROUND,
    border: `1px solid ${DEFAULT_BORDER}`,
    padding: "8px",
    "vertical-align": "top",
    "font-weight": "600",
  });
  applyDefaultStyles(root, "img", {
    "max-width": "100%",
    height: "auto",
  });

  return buildWrapperHtml(root.innerHTML, background);
}
