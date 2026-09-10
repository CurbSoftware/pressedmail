import DOMPurify from "dompurify";

const TRANSPARENT_GIF =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * Unified DOMPurify configuration for email HTML sanitization.
 *
 * Uses an allowlist approach (most secure) combined with explicit forbids
 * as defense-in-depth. This replaces the inline DOMPurify configs that
 * previously existed across multiple reading-pane renderers,
 * and frontend InboxView.
 */
const EMAIL_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    // Text structure
    "p",
    "br",
    "div",
    "span",
    "pre",
    "code",
    "blockquote",
    "hr",
    // Headings
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    // Inline formatting
    "b",
    "i",
    "u",
    "strong",
    "em",
    "s",
    "strike",
    "del",
    "ins",
    "sub",
    "sup",
    "small",
    "mark",
    // Lists
    "ul",
    "ol",
    "li",
    "dl",
    "dt",
    "dd",
    // Tables
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "caption",
    "colgroup",
    "col",
    // Media
    "img",
    // Links
    "a",
    "link",
    "style",
    // Definition/figure
    "figure",
    "figcaption",
    // Legacy email-common tags
    "center",
    "font",
  ],
  ALLOWED_ATTR: [
    "href",
    "src",
    "class",
    "id",
    "style",
    "alt",
    "title",
    "width",
    "height",
    "align",
    "valign",
    "bgcolor",
    "border",
    "cellpadding",
    "cellspacing",
    "colspan",
    "rowspan",
    "color",
    "face",
    "size",
    "target",
    "rel",
    "type",
    "media",
    // Accessibility
    "role",
    "aria-label",
    "aria-hidden",
    // Image blocking markers (preserved through sanitization)
    "data-blocked-src",
    "data-blocked",
  ],
  FORBID_TAGS: [
    "script",
    "meta",
    "base",
    "form",
    "input",
    "button",
    "textarea",
    "select",
    "option",
    "object",
    "embed",
    "applet",
    "frame",
    "frameset",
    "iframe",
    // SVG/MathML can contain malicious content
    "svg",
    "math",
  ],
  FORBID_ATTR: [
    // All event handlers
    "onload",
    "onerror",
    "onclick",
    "ondblclick",
    "onmousedown",
    "onmouseup",
    "onmouseover",
    "onmousemove",
    "onmouseout",
    "onmouseenter",
    "onmouseleave",
    "onfocus",
    "onblur",
    "onkeydown",
    "onkeypress",
    "onkeyup",
    "onsubmit",
    "onreset",
    "onselect",
    "onchange",
    "oninput",
    "onabort",
    "onscroll",
    "onresize",
    "oncontextmenu",
    "ondrag",
    "ondrop",
    "ontouchstart",
    "ontouchend",
    "ontouchmove",
    "onwheel",
    "onanimationstart",
    "onanimationend",
    "ontransitionend",
    // Redirect/navigation
    "http-equiv",
    "action",
    "formaction",
    // Tracking
    "ping",
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  // Keep leading stylesheets inside the fragment so DOMPurify checks them too.
  FORCE_BODY: true,
};

const SAFE_STYLESHEET_URL = /^https:\/\//i;

export function sanitizeEmailCssText(css: string): string {
  if (!css) return "";

  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(
      /@import\s+(?!(?:url\(\s*['"]?https:\/\/|['"]https:\/\/))[^;]+;?/gi,
      "",
    )
    .replace(/(?:expression|behavior|-moz-binding)\s*[:(][^;)}]*[;)]?/gi, "")
    .replace(/(?:javascript|vbscript|data)\s*:/gi, "")
    .replace(
      /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
      (_match, _quote: string, rawUrl: string) => {
        const url = rawUrl.trim();
        if (/^(https?:\/\/|cid:)/i.test(url)) {
          return `url("${url}")`;
        }

        return 'url("")';
      },
    )
    .trim();
}

function stripEmailDocumentArtifacts(html: string): string {
  if (!html) return "";

  return html
    .replace(/<\s*title\b[^>]*>[\s\S]*?<\s*\/\s*title\s*>/gi, " ")
    .replace(/<\s*\/?\s*(?:html|head|body)\b[^>]*>/gi, " ");
}

function isHiddenPreviewStyle(style: string): boolean {
  if (!style) return false;

  return (
    /(?:display\s*:\s*none|visibility\s*:\s*hidden|mso-hide\s*:\s*all)/i.test(
      style,
    ) ||
    /opacity\s*:\s*(?:0|0\.0+)\b/i.test(style) ||
    (/max-height\s*:\s*0(?:px|em|rem|%)?/i.test(style) &&
      /overflow(?:-[xy])?\s*:\s*hidden/i.test(style)) ||
    (/font-size\s*:\s*(?:0|1px)\b/i.test(style) &&
      /line-height\s*:\s*(?:0|1px)\b/i.test(style))
  );
}

function isHiddenPreviewElement(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  if (
    ![
      "div",
      "span",
      "p",
      "table",
      "tbody",
      "tr",
      "td",
      "center",
      "font",
    ].includes(tag)
  ) {
    return false;
  }

  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!text || text.length > 500) return false;

  const classAndId =
    `${element.getAttribute("class") ?? ""} ${element.getAttribute("id") ?? ""}`.toLowerCase();
  if (classAndId.includes("preheader")) return true;

  return isHiddenPreviewStyle(element.getAttribute("style") ?? "");
}

function stripLeadingHiddenPreviewArtifacts(html: string): string {
  if (!html || typeof DOMParser === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<div id="__pm-email-root">${html}</div>`,
    "text/html",
  );
  const root = doc.getElementById("__pm-email-root");
  if (!root) return html;

  let node = root.firstChild;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
      node = node.nextSibling;
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) break;

    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    if (tag === "style" || tag === "link" || tag === "br") {
      node = node.nextSibling;
      continue;
    }
    if (!isHiddenPreviewElement(element)) break;

    const next = node.nextSibling;
    root.removeChild(node);
    node = next;
  }

  return root.innerHTML;
}

function normalizeEmailCss(html: string): string {
  if (!html || typeof DOMParser === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<div id="__pm-email-root">${html}</div>`,
    "text/html",
  );
  const root = doc.getElementById("__pm-email-root");
  if (!root) return html;

  root.querySelectorAll("[style]").forEach((element) => {
    const sanitized = sanitizeEmailCssText(element.getAttribute("style") || "");
    if (sanitized) {
      element.setAttribute("style", sanitized);
    } else {
      element.removeAttribute("style");
    }
  });

  root.querySelectorAll("style").forEach((style) => {
    style.textContent = sanitizeEmailCssText(style.textContent || "");
  });

  root.querySelectorAll("link").forEach((link) => {
    const rel = (link.getAttribute("rel") || "").toLowerCase();
    const href = (link.getAttribute("href") || "").trim();
    if (
      !rel.split(/\s+/).includes("stylesheet") ||
      !SAFE_STYLESHEET_URL.test(href)
    ) {
      link.remove();
    }
  });

  return root.innerHTML;
}

function sanitizeHtml(
  html: string,
  config: typeof EMAIL_SANITIZE_CONFIG,
): string {
  const sanitized = DOMPurify.sanitize(
    stripEmailDocumentArtifacts(html),
    config,
  );
  const normalized = stripLeadingHiddenPreviewArtifacts(
    normalizeEmailCss(sanitized),
  );

  // CSS cleanup can form HTML delimiters. Sanitize after all transformations.
  return DOMPurify.sanitize(normalized, config);
}

/**
 * Sanitize email HTML for safe rendering inside the EmailSandbox iframe.
 *
 * This provides defense-in-depth: the iframe sandbox already prevents JS
 * execution and CSS escape, but DOMPurify strips malicious content before
 * it even reaches the iframe.
 */
export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, EMAIL_SANITIZE_CONFIG);
}

/**
 * Sanitize user-authored HTML for preview rendering (signatures, content
 * blocks, template previews). Stylesheets cannot affect the parent document.
 */
export function sanitizePreviewHtml(html: string): string {
  return sanitizeHtml(html, {
    ...EMAIL_SANITIZE_CONFIG,
    FORBID_TAGS: [...EMAIL_SANITIZE_CONFIG.FORBID_TAGS, "style", "link"],
  });
}

/**
 * Block external images in sanitized HTML by replacing src with a transparent
 * placeholder. Returns the modified HTML and count of blocked images.
 *
 * Skips inline images (data: and cid: URIs) which are embedded in the email.
 */
export function blockExternalImages(html: string): {
  html: string;
  blockedCount: number;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<div id="__root">${html}</div>`,
    "text/html",
  );
  const images = doc.querySelectorAll("img[src]");
  let blockedCount = 0;

  images.forEach((img) => {
    const src = img.getAttribute("src") || "";
    const normalizedSrc = src.trim().toLowerCase();
    // Only block external URLs, skip data: and cid: (inline/embedded images)
    if (
      normalizedSrc.startsWith("http://") ||
      normalizedSrc.startsWith("https://") ||
      normalizedSrc.startsWith("//")
    ) {
      img.setAttribute("data-blocked-src", src);
      img.setAttribute("data-blocked", "true");
      img.setAttribute("src", TRANSPARENT_GIF);
      if (!img.getAttribute("alt")) {
        img.setAttribute("alt", "[Image blocked]");
      }
      blockedCount++;
    }
  });

  const root = doc.getElementById("__root");
  return { html: root ? root.innerHTML : html, blockedCount };
}
