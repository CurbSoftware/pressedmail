import type { Value } from "@kit/plate";
import { createSlateEditor } from "@kit/plate";
import DOMPurify from "dompurify";

import {
  deserializeLegacyHtmlStatic,
  serializePlateValueToHtml,
} from "@/components/composer/plate-composer-serialization.active";
import { ComposerEditorPlugins } from "@/components/composer/plate-composer-plugins";

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const UNSAFE_LINK_PROTOCOLS = new Set([
  "javascript:",
  "data:",
  "file:",
  "vbscript:",
]);

const COMPOSER_HTML_TAGS = [
  "a",
  "b",
  "blockquote",
  "br",
  "caption",
  "center",
  "code",
  "col",
  "colgroup",
  "dd",
  "del",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "font",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "s",
  "small",
  "span",
  "strike",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
] as const;

const COMPOSER_HTML_ATTRIBUTES = [
  "align",
  "alt",
  "bgcolor",
  "border",
  "cellpadding",
  "cellspacing",
  "color",
  "colspan",
  "face",
  "height",
  "href",
  "rel",
  "reversed",
  "role",
  "rowspan",
  "size",
  "src",
  "start",
  "style",
  "target",
  "title",
  "type",
  "valign",
  "width",
  "data-pm-block",
  "data-account-id",
  "data-signature-id",
  "data-collapsed",
  "data-source-from",
  "data-source-date",
  "data-filename",
  "data-size",
  "data-attachment-id",
  "data-accepted",
  "data-suggestion-id",
  "data-pm-list-style",
  "data-pm-list-indent",
  "data-pm-list-start",
  "data-pm-list-restart",
] as const;

const KNOWN_PM_ATTRIBUTES: Set<string> = new Set(
  COMPOSER_HTML_ATTRIBUTES.filter((attribute) => attribute.startsWith("data-")),
);

const COMPOSER_STYLE_PROPERTIES = new Set([
  "background-color",
  "border",
  "border-bottom",
  "border-color",
  "border-left",
  "border-radius",
  "border-right",
  "border-style",
  "border-top",
  "border-width",
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "height",
  "line-height",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "table-layout",
  "text-align",
  "text-decoration",
  "vertical-align",
  "white-space",
  "width",
  "word-break",
]);

const IMPORT_WARNING_UNSAFE =
  "Executable or unsafe content was removed from the imported HTML.";
const IMPORT_WARNING_SIMPLIFIED =
  "Some layout or styling is not supported by the composer and was simplified.";
const IMPORT_WARNING_EXTERNAL_CSS =
  "External stylesheets were ignored; PressedMail never fetches them during import.";
const IMPORT_WARNING_EMBEDDED_CSS =
  "Some embedded stylesheet rules could not be applied and were simplified.";
const IMPORT_WARNING_MALFORMED_MARKDOWN =
  "Malformed Markdown or MDX was imported as readable text; formatting may be simplified.";

type ComposerHtmlDeserializer = {
  deserialize: (options: { element: string | HTMLElement }) => unknown[];
};

export interface ComposerImportResult {
  value: Value;
  bodyBackgroundColor?: string;
  warnings: string[];
}

type ComposerSerializationNode = {
  type?: string;
  text?: string;
  children?: ComposerSerializationNode[];
  filename?: unknown;
  url?: unknown;
  href?: unknown;
  src?: unknown;
  width?: unknown;
  [key: string]: unknown;
};

type ComposerListMetadata = {
  style: string;
  indent: number;
  text: string;
  start?: number;
  restart?: number;
};

function addWarning(warnings: Set<string>, warning: string): void {
  warnings.add(warning);
}

export function normalizeComposerLinkUrl(input: string): string | null {
  const value = input.trim();

  if (!value) return null;

  const lower = value.toLowerCase();
  const schemeMatch = lower.match(/^([a-z][a-z0-9+.-]*):/);

  if (schemeMatch && UNSAFE_LINK_PROTOCOLS.has(`${schemeMatch[1]}:`)) {
    return null;
  }

  if (lower.startsWith("mailto:")) {
    return value.length > "mailto:".length ? value : null;
  }
  if (lower.startsWith("tel:")) {
    return value.length > "tel:".length ? value : null;
  }

  const candidate = schemeMatch ? value : `https://${value}`;

  try {
    const parsed = new URL(candidate);
    return SAFE_LINK_PROTOCOLS.has(parsed.protocol) ? candidate : null;
  } catch {
    return null;
  }
}

function isSafeImportedUrl(value: string, attribute: "href" | "src"): boolean {
  const candidate = value.trim();
  if (!candidate) return false;

  if (candidate.startsWith("#")) return attribute === "href";
  if (candidate.startsWith("/")) return true;

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(candidate)?.[1]?.toLowerCase();
  if (!scheme) return false;
  const protocol = `${scheme}:`;
  return attribute === "src"
    ? protocol === "http:" || protocol === "https:"
    : SAFE_LINK_PROTOCOLS.has(protocol);
}

function normalizeCssColor(
  value: string | null | undefined,
): string | undefined {
  const candidate = value?.trim();
  if (!candidate || /[;{}]|url\s*\(|expression\s*\(/i.test(candidate)) {
    return undefined;
  }

  const probe = document.createElement("span");
  probe.style.color = candidate;
  return probe.style.color ? candidate : undefined;
}

function sanitizeStyleAttribute(style: string, warnings: Set<string>): string {
  const probe = document.createElement("span");
  probe.setAttribute("style", style);
  const safeDeclarations: string[] = [];

  for (const property of Array.from(probe.style)) {
    const value = probe.style.getPropertyValue(property).trim();
    const normalizedProperty = property.toLowerCase();
    if (
      !COMPOSER_STYLE_PROPERTIES.has(normalizedProperty) ||
      /(?:expression|behavior|-moz-binding|url)\s*[:(]/i.test(value) ||
      /(?:javascript|vbscript|data)\s*:/i.test(value)
    ) {
      addWarning(warnings, IMPORT_WARNING_SIMPLIFIED);
      continue;
    }
    const rawDeclaration = style
      .split(";")
      .map((declaration) => declaration.trim())
      .find(
        (declaration) =>
          declaration
            .slice(0, declaration.indexOf(":"))
            .trim()
            .toLowerCase() === normalizedProperty,
      );
    const rawValue = rawDeclaration
      ?.slice(rawDeclaration.indexOf(":") + 1)
      .trim();
    safeDeclarations.push(
      `${normalizedProperty}: ${rawValue || value}${
        probe.style.getPropertyPriority(property) &&
        !/!important$/i.test(rawValue ?? "")
          ? " !important"
          : ""
      }`,
    );
  }

  if (style.trim() && safeDeclarations.length === 0) {
    addWarning(warnings, IMPORT_WARNING_SIMPLIFIED);
  }
  return safeDeclarations.length > 0 ? `${safeDeclarations.join("; ")};` : "";
}

function sanitizeEmbeddedCss(css: string, warnings: Set<string>): string {
  const sanitized = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@import[\s\S]*?(?:;|$)/gi, () => {
      addWarning(warnings, IMPORT_WARNING_EXTERNAL_CSS);
      return "";
    })
    .replace(/url\s*\([^)]*\)/gi, () => {
      addWarning(warnings, IMPORT_WARNING_SIMPLIFIED);
      return 'url("")';
    })
    .replace(
      /(?:expression|behavior|-moz-binding)\s*[:(][^;)}]*[;)]?/gi,
      () => {
        addWarning(warnings, IMPORT_WARNING_UNSAFE);
        return "";
      },
    );

  return sanitized.trim();
}

function collectImportWarnings(doc: Document, warnings: Set<string>): void {
  if (
    doc.querySelector(
      "script, iframe, object, embed, form, input, button, textarea, select, svg, math",
    )
  ) {
    addWarning(warnings, IMPORT_WARNING_UNSAFE);
  }

  for (const element of Array.from(doc.querySelectorAll("*"))) {
    const tag = element.tagName.toLowerCase();
    if (
      !COMPOSER_HTML_TAGS.includes(
        tag as (typeof COMPOSER_HTML_TAGS)[number],
      ) &&
      !["html", "head", "body", "style", "link", "meta", "title"].includes(tag)
    ) {
      addWarning(warnings, IMPORT_WARNING_SIMPLIFIED);
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on")) addWarning(warnings, IMPORT_WARNING_UNSAFE);
      if (name.startsWith("data-") && !KNOWN_PM_ATTRIBUTES.has(name)) {
        if (
          ![
            "data-pm-document",
            "data-pm-body-background",
            "data-pm-composer-body",
          ].includes(name)
        ) {
          addWarning(warnings, IMPORT_WARNING_SIMPLIFIED);
        }
      }
      if (
        (name === "href" || name === "src") &&
        !isSafeImportedUrl(attribute.value, name)
      ) {
        addWarning(warnings, IMPORT_WARNING_UNSAFE);
      }
    }
  }
}

function extractComposerDocument(html: string): {
  bodyBackgroundColor?: string;
  bodyStyle?: string;
  embeddedStyles: string[];
  sourceHtml: string;
  warnings: Set<string>;
} {
  if (typeof DOMParser === "undefined" || typeof document === "undefined") {
    throw new Error("HTML import is only available in the composer browser.");
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const warnings = new Set<string>();
  collectImportWarnings(doc, warnings);

  if (doc.querySelector('link[rel~="stylesheet" i]')) {
    addWarning(warnings, IMPORT_WARNING_EXTERNAL_CSS);
  }

  const embeddedStyles = Array.from(doc.querySelectorAll("style"))
    .map((style) => sanitizeEmbeddedCss(style.textContent ?? "", warnings))
    .filter(Boolean);
  const canonicalBody = doc.querySelector<HTMLElement>(
    '[data-pm-composer-body="true"]',
  );
  const metadataBackground =
    doc.body.getAttribute("data-pm-body-background") ??
    doc.documentElement.getAttribute("data-pm-body-background");
  const bodyBackgroundColor = normalizeCssColor(
    metadataBackground ||
      doc.body.style.backgroundColor ||
      doc.body.getAttribute("bgcolor"),
  );

  return {
    ...(bodyBackgroundColor ? { bodyBackgroundColor } : {}),
    ...(doc.body.getAttribute("style")
      ? { bodyStyle: doc.body.getAttribute("style") ?? undefined }
      : {}),
    embeddedStyles,
    sourceHtml: canonicalBody ? canonicalBody.innerHTML : doc.body.innerHTML,
    warnings,
  };
}

function extractInlinedComposerBody(html: string): {
  bodyBackgroundColor?: string;
  html: string;
} {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const inheritedProperties = [
    "color",
    "font-family",
    "font-size",
    "font-style",
    "font-weight",
    "line-height",
    "text-align",
  ];
  const inheritedStyle = inheritedProperties
    .map((property) => {
      const value = doc.body.style.getPropertyValue(property);
      return value ? `${property}: ${value};` : "";
    })
    .filter(Boolean)
    .join(" ");
  const bodyBackgroundColor = normalizeCssColor(
    doc.body.style.backgroundColor || doc.body.getAttribute("bgcolor"),
  );
  const bodyHtml = doc.body.innerHTML;

  return {
    ...(bodyBackgroundColor ? { bodyBackgroundColor } : {}),
    html: inheritedStyle
      ? `<div style="${escapeHtmlAttribute(inheritedStyle)}">${bodyHtml}</div>`
      : bodyHtml,
  };
}

const INITIAL_COMPOSER_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [...COMPOSER_HTML_TAGS, "style"],
  ALLOWED_ATTR: [...COMPOSER_HTML_ATTRIBUTES, "class", "id"],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  KEEP_CONTENT: true,
};

const FINAL_COMPOSER_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [...COMPOSER_HTML_TAGS],
  ALLOWED_ATTR: [...COMPOSER_HTML_ATTRIBUTES],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  KEEP_CONTENT: true,
};

function hardenComposerHtml(
  html: string,
  warnings: Set<string>,
  finalPass: boolean,
): string {
  const sanitized = DOMPurify.sanitize(
    html,
    finalPass
      ? FINAL_COMPOSER_SANITIZE_CONFIG
      : INITIAL_COMPOSER_SANITIZE_CONFIG,
  ) as unknown as string;
  const template = document.createElement("template");
  template.innerHTML = sanitized;

  for (const element of Array.from(template.content.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
        addWarning(warnings, IMPORT_WARNING_UNSAFE);
      } else if (name.startsWith("data-") && !KNOWN_PM_ATTRIBUTES.has(name)) {
        element.removeAttribute(attribute.name);
        addWarning(warnings, IMPORT_WARNING_SIMPLIFIED);
      }
    }

    let removedElement = false;
    for (const attributeName of ["href", "src"] as const) {
      const value = element.getAttribute(attributeName);
      if (value && !isSafeImportedUrl(value, attributeName)) {
        addWarning(warnings, IMPORT_WARNING_UNSAFE);
        if (
          attributeName === "src" &&
          element.tagName.toLowerCase() === "img"
        ) {
          const alt = element.getAttribute("alt")?.trim();
          element.replaceWith(document.createTextNode(alt || ""));
          removedElement = true;
          break;
        }
        element.removeAttribute(attributeName);
      }
    }

    if (removedElement) continue;

    const style = element.getAttribute("style");
    if (style !== null) {
      const safeStyle = sanitizeStyleAttribute(style, warnings);
      if (safeStyle) element.setAttribute("style", safeStyle);
      else element.removeAttribute("style");
    }
  }

  return template.innerHTML;
}

function preserveInheritedComposerMarks(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const blockSelector = "p, div, h1, h2, h3, h4, h5, h6, blockquote, li";
  const inheritedProperties = [
    "background-color",
    "color",
    "font-family",
    "font-size",
    "font-style",
    "font-weight",
    "text-decoration",
  ];

  for (const element of Array.from(
    template.content.querySelectorAll<HTMLElement>(blockSelector),
  )) {
    const declarations: string[] = [];
    for (const property of inheritedProperties) {
      const value = element.style.getPropertyValue(property);
      if (!value) continue;
      declarations.push(`${property}: ${value};`);
      element.style.removeProperty(property);
    }
    if (declarations.length === 0 || !element.hasChildNodes()) continue;

    const wrapper = document.createElement("span");
    wrapper.setAttribute("style", declarations.join(" "));
    while (element.firstChild) wrapper.append(element.firstChild);
    element.append(wrapper);
    if (!element.getAttribute("style")) element.removeAttribute("style");
  }

  return template.innerHTML;
}

async function inlineEmbeddedComposerCss(
  html: string,
  warnings: Set<string>,
): Promise<string> {
  if (!/<style\b/i.test(html)) return html;

  try {
    const { JuicePlugin } = await import("@kit/plate/juice");
    const transformData = (
      JuicePlugin as unknown as {
        inject?: {
          plugins?: Record<
            string,
            {
              parser?: {
                transformData?: (input: { data: string }) => string;
              };
            }
          >;
        };
      }
    ).inject?.plugins?.html?.parser?.transformData;

    if (!transformData) {
      addWarning(warnings, IMPORT_WARNING_EMBEDDED_CSS);
      return html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
    }

    return transformData({ data: html });
  } catch {
    addWarning(warnings, IMPORT_WARNING_EMBEDDED_CSS);
    return html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  }
}

function valueHasImportableContent(value: Value): boolean {
  const meaningfulTypes = new Set([
    "attachment",
    "audio",
    "file",
    "hr",
    "horizontal_rule",
    "image",
    "img",
    "media_embed",
    "table",
    "video",
  ]);

  const visit = (nodes: ComposerSerializationNode[]): boolean =>
    nodes.some((node) => {
      if (typeof node.text === "string" && node.text.trim()) return true;
      if (node.type && meaningfulTypes.has(node.type)) return true;
      return Array.isArray(node.children) && visit(node.children);
    });

  return visit(value as unknown as ComposerSerializationNode[]);
}

function readPositiveInteger(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function collectComposerListMetadata(html: string): ComposerListMetadata[] {
  const template = document.createElement("template");
  template.innerHTML = html;

  return Array.from(
    template.content.querySelectorAll<HTMLElement>("li[data-pm-list-style]"),
  ).map((item) => ({
    style: item.dataset.pmListStyle || "disc",
    indent: readPositiveInteger(item.dataset.pmListIndent) ?? 1,
    text: Array.from(item.childNodes)
      .filter(
        (child) =>
          !(child instanceof HTMLElement) ||
          !["ol", "ul"].includes(child.tagName.toLowerCase()),
      )
      .map((child) => child.textContent ?? "")
      .join("")
      .trim(),
    ...(readPositiveInteger(item.dataset.pmListStart)
      ? { start: readPositiveInteger(item.dataset.pmListStart) }
      : {}),
    ...(readPositiveInteger(item.dataset.pmListRestart)
      ? { restart: readPositiveInteger(item.dataset.pmListRestart) }
      : {}),
  }));
}

const COMPOSER_LIST_IMPORT_MARKER_PREFIX = "\u2063pressedmail-list-";
const COMPOSER_LIST_IMPORT_MARKER_PATTERN =
  /\u2063pressedmail-list-(\d+)\u2063/;
const COMPOSER_HORIZONTAL_RULE_IMPORT_MARKER = "\u2063pressedmail-hr\u2063";

function composerListImportMarker(index: number): string {
  return `${COMPOSER_LIST_IMPORT_MARKER_PREFIX}${index}\u2063`;
}

function flattenCanonicalComposerListsForPlate(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const lists = Array.from(
    template.content.querySelectorAll<HTMLOListElement | HTMLUListElement>(
      "ol, ul",
    ),
  ).filter(
    (list) =>
      list.querySelector("li[data-pm-list-style]") &&
      !list.parentElement?.closest("ol, ul"),
  );
  let markerIndex = 0;

  for (const list of lists) {
    const flattened = document.createDocumentFragment();
    for (const item of Array.from(
      list.querySelectorAll<HTMLLIElement>("li[data-pm-list-style]"),
    )) {
      const block = document.createElement("p");
      const indent = readPositiveInteger(item.dataset.pmListIndent) ?? 1;
      block.style.display = "list-item";
      block.style.listStyleType = item.dataset.pmListStyle || "disc";
      block.style.marginLeft = `${indent * 24}px`;
      for (const attribute of [
        "data-pm-list-style",
        "data-pm-list-indent",
        "data-pm-list-start",
        "data-pm-list-restart",
      ]) {
        const value = item.getAttribute(attribute);
        if (value !== null) block.setAttribute(attribute, value);
      }
      block.append(
        document.createTextNode(composerListImportMarker(markerIndex)),
      );
      markerIndex += 1;
      for (const child of Array.from(item.childNodes)) {
        if (
          child instanceof HTMLElement &&
          ["ol", "ul"].includes(child.tagName.toLowerCase())
        ) {
          continue;
        }
        if (
          child instanceof HTMLElement &&
          ["div", "p"].includes(child.tagName.toLowerCase())
        ) {
          for (const nestedChild of Array.from(child.childNodes)) {
            block.append(nestedChild.cloneNode(true));
          }
        } else {
          block.append(child.cloneNode(true));
        }
      }
      flattened.append(block);
    }
    list.replaceWith(flattened);
  }

  return template.innerHTML;
}

function markComposerHorizontalRulesForPlate(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;

  for (const rule of Array.from(template.content.querySelectorAll("hr"))) {
    const marker = document.createElement("p");
    marker.textContent = COMPOSER_HORIZONTAL_RULE_IMPORT_MARKER;
    rule.replaceWith(marker);
  }

  return template.innerHTML;
}

function restoreComposerHorizontalRules(value: Value): Value {
  const visit = (nodes: ComposerSerializationNode[]) => {
    for (const node of nodes) {
      if (
        typeof node.text !== "string" &&
        (node.children ?? []).some(
          (child) => child.text === COMPOSER_HORIZONTAL_RULE_IMPORT_MARKER,
        )
      ) {
        node.type = "hr";
        node.children = [{ text: "" }];
        continue;
      }
      if (Array.isArray(node.children)) visit(node.children);
    }
  };

  visit(value as unknown as ComposerSerializationNode[]);
  return value;
}

function restoreComposerListMetadata(
  value: Value,
  metadata: ComposerListMetadata[],
): Value {
  if (metadata.length === 0) return value;

  const nodeText = (node: ComposerSerializationNode): string =>
    typeof node.text === "string"
      ? node.text
      : (node.children ?? []).map(nodeText).join("");

  const takeListMarker = (
    node: ComposerSerializationNode,
  ): number | undefined => {
    if (typeof node.text === "string") {
      const match = COMPOSER_LIST_IMPORT_MARKER_PATTERN.exec(node.text);
      if (!match) return undefined;
      node.text = node.text.replace(match[0], "");
      return Number(match[1]);
    }
    for (const child of node.children ?? []) {
      const marker = takeListMarker(child);
      if (marker !== undefined) return marker;
    }
    return undefined;
  };

  const applyListMetadata = (
    node: ComposerSerializationNode,
    marker: number,
  ) => {
    const item = metadata[marker];
    if (!item) return;

    node.listStyleType = item.style;
    node.indent = item.indent;
    if (item.start !== undefined) node.listStart = item.start;
    if (item.restart !== undefined) {
      node.listRestartPolite = item.restart;
    }
  };

  const visit = (nodes: ComposerSerializationNode[]) => {
    let index = 0;
    while (index < nodes.length) {
      const node = nodes[index];
      if (!node) break;
      const marker = takeListMarker(node);
      if (marker !== undefined) {
        applyListMetadata(node, marker);
      }

      if (marker !== undefined && !nodeText(node).trim() && nodes[index + 1]) {
        const target = nodes[index + 1]!;
        applyListMetadata(target, marker);
        nodes.splice(index, 1);
        if (Array.isArray(target.children)) visit(target.children);
        index += 1;
        continue;
      }

      if (Array.isArray(node.children)) visit(node.children);
      index += 1;
    }
  };

  const nodes = value as unknown as ComposerSerializationNode[];
  visit(nodes);
  return nodes.filter(
    (node) =>
      nodeText(node).trim() ||
      typeof node.listStyleType === "string" ||
      !["p", "paragraph"].includes(node.type ?? ""),
  ) as unknown as Value;
}

/**
 * Safely import editable composer HTML. The live editor's HTML API is the
 * authority because it has the exact active plugin set; the edition-specific
 * static parser is retained as a compatibility fallback.
 */
export async function deserializeComposerHtmlToPlateValue(
  html: string,
  editorHtmlApi?: ComposerHtmlDeserializer,
): Promise<ComposerImportResult> {
  if (!html.trim()) throw new Error("HTML import is empty.");

  const extracted = extractComposerDocument(html);
  const styleTags = extracted.embeddedStyles
    .map((css) => `<style>${css}</style>`)
    .join("");
  const safeBodyStyle = extracted.bodyStyle
    ? sanitizeStyleAttribute(extracted.bodyStyle, extracted.warnings)
    : "";
  const sanitizedBody = hardenComposerHtml(
    extracted.sourceHtml,
    extracted.warnings,
    false,
  );
  let sanitizedHtml = `<!doctype html><html><head>${styleTags}</head><body${
    safeBodyStyle ? ` style="${escapeHtmlAttribute(safeBodyStyle)}"` : ""
  }>${sanitizedBody}</body></html>`;
  sanitizedHtml = await inlineEmbeddedComposerCss(
    sanitizedHtml,
    extracted.warnings,
  );
  const inlinedBody = extractInlinedComposerBody(sanitizedHtml);
  sanitizedHtml = inlinedBody.html;
  sanitizedHtml = hardenComposerHtml(sanitizedHtml, extracted.warnings, true);
  sanitizedHtml = preserveInheritedComposerMarks(sanitizedHtml);
  const listMetadata = collectComposerListMetadata(sanitizedHtml);
  sanitizedHtml = flattenCanonicalComposerListsForPlate(sanitizedHtml);
  sanitizedHtml = markComposerHorizontalRulesForPlate(sanitizedHtml);

  const probe = document.createElement("template");
  probe.innerHTML = sanitizedHtml;
  const sourceHasContent = Boolean(
    probe.content.textContent?.trim() ||
    probe.content.querySelector("img, hr, table, [data-pm-block]"),
  );
  if (!sourceHasContent) {
    throw new Error("This HTML does not contain importable composer content.");
  }

  let value: Value | undefined;
  if (editorHtmlApi) {
    try {
      const liveValue = editorHtmlApi.deserialize({
        element: sanitizedHtml,
      }) as Value;
      if (valueHasImportableContent(liveValue)) value = liveValue;
    } catch {
      // Fall through to the edition-specific static parser.
    }
  }

  if (!value) {
    const staticValue = deserializeLegacyHtmlStatic(sanitizedHtml);
    if (valueHasImportableContent(staticValue)) value = staticValue;
  }

  if (!value) {
    throw new Error(
      "The imported HTML could not be converted. Existing content was preserved.",
    );
  }

  return {
    value: restoreComposerListMetadata(
      restoreComposerHorizontalRules(value),
      listMetadata,
    ),
    ...(extracted.bodyBackgroundColor
      ? { bodyBackgroundColor: extracted.bodyBackgroundColor }
      : inlinedBody.bodyBackgroundColor
        ? { bodyBackgroundColor: inlinedBody.bodyBackgroundColor }
        : {}),
    warnings: [...extracted.warnings],
  };
}

async function getComposerRemarkPlugins() {
  const [{ default: remarkGfm }, { remarkMdx }] = await Promise.all([
    import("remark-gfm"),
    import("@kit/plate/markdown"),
  ]);
  return [remarkGfm, remarkMdx];
}

async function createMarkdownEditor(value?: Value) {
  const { MarkdownPlugin } = await import("@kit/plate/markdown");
  return createSlateEditor({
    plugins: [...ComposerEditorPlugins, MarkdownPlugin],
    value,
  });
}

function sanitizeMarkdownStyle(style: string): string {
  const warnings = new Set<string>();
  return sanitizeStyleAttribute(style, warnings);
}

const SAFE_MDX_TAGS = new Set([
  "audio",
  "column",
  "column_group",
  "file",
  "img",
  "media_embed",
  "span",
  "sub",
  "sup",
  "u",
  "video",
]);

function sanitizeMdxTag(
  slash: string,
  rawName: string,
  rawAttributes: string,
  selfClosing: string,
): string {
  const name = rawName.toLowerCase();
  if (!SAFE_MDX_TAGS.has(name)) return "";
  if (slash) return `</${name}>`;

  let attributes = rawAttributes
    .replace(/\s+on[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /\s+(?:dangerouslySetInnerHTML|innerHTML)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
      "",
    );

  attributes = attributes.replace(
    /\s+(href|src)\s*=\s*("([^"]*)"|'([^']*)')/gi,
    (
      _match,
      attributeName: string,
      quoted: string,
      double: string,
      single: string,
    ) => {
      const value = double ?? single ?? "";
      return isSafeImportedUrl(
        value,
        attributeName.toLowerCase() as "href" | "src",
      )
        ? ` ${attributeName.toLowerCase()}=${quoted}`
        : "";
    },
  );

  attributes = attributes.replace(
    /\s+style\s*=\s*("([^"]*)"|'([^']*)')/gi,
    (_match, _quoted: string, double: string, single: string) => {
      const style = sanitizeMarkdownStyle(double ?? single ?? "");
      return style ? ` style="${style.replace(/"/g, "&quot;")}"` : "";
    },
  );

  const allowedAttributeNames =
    name === "span"
      ? new Set(["style"])
      : new Set(["alt", "height", "src", "title", "width"]);
  attributes = attributes.replace(
    /\s+([a-zA-Z_:][\w:.-]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g,
    (attribute, attributeName: string) =>
      allowedAttributeNames.has(attributeName.toLowerCase()) ? attribute : "",
  );

  return `<${name}${attributes}${selfClosing ? " /" : ""}>`;
}

const MARKDOWN_CODE_TOKEN_PREFIX = "PRESSEDMAILMARKDOWNCODETOKEN";

function protectMarkdownCodeSegments(markdown: string): {
  protectedMarkdown: string;
  restore: (value: string) => string;
} {
  const segments: string[] = [];
  const store = (segment: string) => {
    const token = `${MARKDOWN_CODE_TOKEN_PREFIX}${segments.length}END`;
    segments.push(segment);
    return token;
  };
  const fenced = markdown.replace(
    /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*$/gm,
    store,
  );
  const protectedMarkdown = fenced.replace(/(`+)[^`\n]*?\1/g, store);

  return {
    protectedMarkdown,
    restore: (value) =>
      value.replace(
        new RegExp(`${MARKDOWN_CODE_TOKEN_PREFIX}(\\d+)END`, "g"),
        (_match, index: string) => segments[Number(index)] ?? "",
      ),
  };
}

function sanitizeComposerMarkdownSource(markdown: string): string {
  const { protectedMarkdown, restore } = protectMarkdownCodeSegments(markdown);
  const sanitized = protectedMarkdown
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, "$1")
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, "$1")
    .replace(/\{([^{}\n]*)\}/g, "$1")
    .replace(
      /(!?\[[^\]]*\])\(\s*(?:javascript|data|file|vbscript):[^)]*\)/gi,
      "$1",
    )
    .replace(
      /<(\/?)([A-Za-z][\w-]*)(\s[^<>]*?)?(\/?)>/g,
      (
        _match,
        slash: string,
        name: string,
        attributes = "",
        selfClosing = "",
      ) => sanitizeMdxTag(slash, name, attributes, selfClosing),
    );

  return restore(sanitized);
}

function hasMalformedMdxSyntax(markdown: string): boolean {
  const { protectedMarkdown } = protectMarkdownCodeSegments(markdown);
  let braceDepth = 0;

  for (let index = 0; index < protectedMarkdown.length; index += 1) {
    const character = protectedMarkdown[index];
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (character === "{") braceDepth += 1;
    if (character === "}") {
      if (braceDepth === 0) return true;
      braceDepth -= 1;
    }
  }

  return braceDepth !== 0 || /<\/?[A-Za-z][^>\n]*$/m.test(protectedMarkdown);
}

function createReadableMarkdownFallbackValue(markdown: string): Value {
  const safeLiteralText = markdown
    .replace(/\0/g, "")
    .replace(/\r\n?/g, "\n")
    // Plate's static serializer accepts already-authored HTML. Keep malformed
    // MDX visibly recognizable without allowing its angle brackets to become
    // live markup when the editable HTML export is generated.
    .replace(/</g, "‹")
    .replace(/>/g, "›");
  const lines = safeLiteralText.split("\n");

  return (lines.length > 0 ? lines : [""]).map((text) => ({
    type: "p",
    children: [{ text }],
  })) as Value;
}

function sanitizeMarkdownValue(value: Value): Value {
  const visit = (
    nodes: ComposerSerializationNode[],
  ): ComposerSerializationNode[] =>
    nodes.map((node) => {
      const next: ComposerSerializationNode = { ...node };
      for (const key of Object.keys(next)) {
        if (/^on[a-z]/i.test(key) || key === "dangerouslySetInnerHTML") {
          delete next[key];
        }
      }
      for (const key of ["url", "href", "src"] as const) {
        const value = next[key];
        const urlAttribute =
          key === "href" ||
          (key === "url" && ["a", "link"].includes(next.type ?? ""))
            ? "href"
            : "src";
        if (
          typeof value === "string" &&
          !isSafeImportedUrl(value, urlAttribute)
        ) {
          delete next[key];
        }
      }
      if (Array.isArray(next.children)) next.children = visit(next.children);
      return next;
    });

  return visit(
    value as unknown as ComposerSerializationNode[],
  ) as unknown as Value;
}

export async function deserializeComposerMarkdownToImportResult(
  markdown: string,
): Promise<ComposerImportResult> {
  const { deserializeMd } = await import("@kit/plate/markdown");
  const editor = await createMarkdownEditor();

  if (hasMalformedMdxSyntax(markdown)) {
    return {
      value: createReadableMarkdownFallbackValue(markdown),
      warnings: [IMPORT_WARNING_MALFORMED_MARKDOWN],
    };
  }

  let value: Value;
  try {
    value = deserializeMd(editor, sanitizeComposerMarkdownSource(markdown), {
      remarkPlugins: await getComposerRemarkPlugins(),
    }) as Value;
  } catch {
    return {
      value: createReadableMarkdownFallbackValue(markdown),
      warnings: [IMPORT_WARNING_MALFORMED_MARKDOWN],
    };
  }

  return {
    value:
      value.length > 0
        ? sanitizeMarkdownValue(value)
        : deserializeLegacyHtmlStatic(""),
    warnings: [],
  };
}

export async function deserializeComposerMarkdownToPlateValue(
  markdown: string,
): Promise<Value> {
  const result = await deserializeComposerMarkdownToImportResult(markdown);
  return result.value;
}

const MARKDOWN_SUPPORTED_BLOCKS = new Set([
  "blockquote",
  "code_block",
  "code_line",
  "column",
  "column_group",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "lic",
  "ol",
  "p",
  "table",
  "td",
  "th",
  "tr",
  "ul",
]);

const MARKDOWN_SUPPORTED_INLINE = new Set([
  "a",
  "date",
  "image",
  "img",
  "link",
  "mention",
]);

const MARKDOWN_SIGNATURE_SEPARATOR = "PRESSEDMAILSIGNATURESEPARATOR";

function normalizeComposerNodesForMarkdown(
  nodes: ComposerSerializationNode[],
  inlineContext = false,
): ComposerSerializationNode[] {
  const result: ComposerSerializationNode[] = [];

  for (const node of nodes) {
    if (typeof node.text === "string" && node.type === undefined) {
      result.push(node);
      continue;
    }

    const childrenAreInline =
      inlineContext ||
      [
        "a",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "li",
        "lic",
        "link",
        "p",
      ].includes(node.type ?? "");
    const normalizedChildren = Array.isArray(node.children)
      ? normalizeComposerNodesForMarkdown(node.children, childrenAreInline)
      : [{ text: "" }];

    switch (node.type) {
      case "signature": {
        const signatureChildren = [...(node.children ?? [])];
        if (/^--\s*$/.test(extractNodeText(signatureChildren[0] ?? {}))) {
          signatureChildren.shift();
        }
        if (inlineContext) {
          result.push({
            text: `${MARKDOWN_SIGNATURE_SEPARATOR}\n${signatureChildren
              .map(extractNodeText)
              .join("\n")}`,
          });
        } else {
          result.push({
            type: "p",
            children: [{ text: MARKDOWN_SIGNATURE_SEPARATOR }],
          });
          result.push(
            ...normalizeComposerNodesForMarkdown(signatureChildren, false),
          );
        }
        break;
      }
      case "equation": {
        const expression =
          typeof node.texExpression === "string"
            ? node.texExpression.trim()
            : "";
        result.push(
          inlineContext
            ? { text: expression || "[Empty equation]" }
            : {
                type: "p",
                children: [{ text: expression || "[Empty equation]" }],
              },
        );
        break;
      }
      case "inline_equation":
        result.push({
          text:
            typeof node.texExpression === "string" && node.texExpression.trim()
              ? node.texExpression.trim()
              : "[equation]",
        });
        break;
      case "excalidraw": {
        const png = typeof node.png === "string" ? node.png.trim() : "";
        const drawing =
          png && isSafeImportedUrl(png, "src") && /^https?:/i.test(png)
            ? {
                type: "a",
                url: png,
                children: [{ text: "Drawing" }],
              }
            : { text: "[Drawing]" };
        result.push(
          inlineContext ? drawing : { type: "p", children: [drawing] },
        );
        break;
      }
      case "quote":
        result.push({ type: "blockquote", children: normalizedChildren });
        break;
      case "attachment": {
        const filename =
          typeof node.filename === "string" ? node.filename.trim() : "";
        const url = typeof node.url === "string" ? node.url : "";
        result.push(
          url && isSafeImportedUrl(url, "href")
            ? { type: "a", url, children: [{ text: filename || url }] }
            : { text: filename ? `[${filename}]` : "" },
        );
        break;
      }
      case "ai-suggestion":
        result.push(...normalizedChildren);
        break;
      case "callout":
        result.push({ type: "blockquote", children: normalizedChildren });
        break;
      case "toggle":
        result.push(
          inlineContext
            ? { text: normalizedChildren.map(extractNodeText).join("") }
            : { type: "p", children: normalizedChildren },
        );
        break;
      case "file":
      case "audio":
      case "video":
      case "media_embed": {
        const url =
          typeof node.url === "string"
            ? node.url
            : typeof node.src === "string"
              ? node.src
              : "";
        if (url && isSafeImportedUrl(url, "href")) {
          result.push({
            type: "a",
            url,
            children:
              normalizedChildren.length > 0
                ? normalizedChildren
                : [{ text: url }],
          });
        } else {
          result.push(...normalizedChildren);
        }
        break;
      }
      default: {
        const supported = inlineContext
          ? MARKDOWN_SUPPORTED_INLINE.has(node.type ?? "")
          : MARKDOWN_SUPPORTED_BLOCKS.has(node.type ?? "") ||
            MARKDOWN_SUPPORTED_INLINE.has(node.type ?? "");
        if (supported) {
          const safeNode: ComposerSerializationNode = {
            ...node,
            children: normalizedChildren,
          };
          delete safeNode.id;
          result.push(safeNode);
        } else if (inlineContext) {
          result.push(
            ...normalizeComposerNodesForMarkdown(node.children ?? [], true),
          );
        } else {
          result.push({
            type: "p",
            children: normalizeComposerNodesForMarkdown(
              node.children ?? [],
              true,
            ),
          });
        }
      }
    }
  }

  return result;
}

function extractNodeText(node: ComposerSerializationNode): string {
  if (typeof node.text === "string") return node.text;
  return (node.children ?? []).map(extractNodeText).join("");
}

export async function serializePlateValueToMarkdown(
  value: Value,
): Promise<string> {
  const { serializeMd } = await import("@kit/plate/markdown");
  const normalized = normalizeComposerNodesForMarkdown(
    value as unknown as ComposerSerializationNode[],
  ) as unknown as Value;
  const editor = await createMarkdownEditor(normalized);
  const markdown = serializeMd(editor, {
    remarkPlugins: await getComposerRemarkPlugins(),
  });

  return sanitizeComposerMarkdownSource(markdown).replace(
    new RegExp(MARKDOWN_SIGNATURE_SEPARATOR, "g"),
    "-- ",
  );
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Serialize canonical, editable PressedMail HTML for loss-minimized reimport. */
export async function serializePlateValueToEditableHtml(
  value: Value,
  options: { bodyBackgroundColor?: string } = {},
): Promise<string> {
  const content = await serializeComposerEditableFragment(value);
  const background = normalizeCssColor(options.bodyBackgroundColor);
  const backgroundAttributes = background
    ? ` data-pm-body-background="${escapeHtmlAttribute(background)}" style="background-color: ${escapeHtmlAttribute(background)};"`
    : "";

  return [
    "<!doctype html>",
    '<html data-pm-document="composer">',
    '<head><meta charset="utf-8"></head>',
    `<body${backgroundAttributes}>`,
    `<div data-pm-composer-body="true">${content}</div>`,
    "</body>",
    "</html>",
  ].join("\n");
}


function isFlatComposerListNode(node: ComposerSerializationNode): boolean {
  return (
    typeof node.listStyleType === "string" && node.listStyleType.length > 0
  );
}

function cloneWithoutFlatListMetadata(
  node: ComposerSerializationNode,
): ComposerSerializationNode {
  const clone = { ...node };
  delete clone.indent;
  delete clone.listStyleType;
  delete clone.listStart;
  delete clone.listRestartPolite;
  return clone;
}

type EditableListLevel = {
  list: HTMLOListElement | HTMLUListElement;
  style: string;
  ordered: boolean;
  lastItem?: HTMLLIElement;
  nextStart?: number;
};

function createEditableList(
  node: ComposerSerializationNode,
): EditableListLevel {
  const style = String(node.listStyleType || "disc");
  const ordered = isOrderedListStyle(style);
  const list = document.createElement(ordered ? "ol" : "ul");
  const start =
    readPositiveInteger(node.listRestartPolite) ??
    readPositiveInteger(node.listStart);

  list.style.listStyleType = style;
  list.style.margin = "0 0 0 20px";
  list.style.padding = "0";
  if (ordered && start !== undefined) (list as HTMLOListElement).start = start;

  return {
    list,
    style,
    ordered,
    ...(ordered ? { nextStart: start ?? 1 } : {}),
  };
}

async function serializeFlatComposerListRun(
  nodes: ComposerSerializationNode[],
): Promise<string> {
  const root = document.createElement("div");
  const levels: EditableListLevel[] = [];

  for (const node of nodes) {
    let depth = Math.max(1, readPositiveInteger(node.indent) ?? 1);
    depth = Math.min(depth, levels.length + 1);
    levels.length = Math.min(levels.length, depth);

    const style = String(node.listStyleType || "disc");
    const ordered = isOrderedListStyle(style);
    const itemStart = readPositiveInteger(node.listStart);
    const restart = readPositiveInteger(node.listRestartPolite);
    let level = levels[depth - 1];
    const sequenceChanged =
      ordered &&
      itemStart !== undefined &&
      level?.nextStart !== undefined &&
      itemStart !== level.nextStart;

    if (
      !level ||
      level.style !== style ||
      level.ordered !== ordered ||
      restart !== undefined ||
      sequenceChanged
    ) {
      levels.length = depth - 1;
      level = createEditableList(node);
      const parent = levels[depth - 2];
      if (parent?.lastItem) parent.lastItem.append(level.list);
      else root.append(level.list);
      levels.push(level);
    }

    const item = document.createElement("li");
    item.dataset.pmListStyle = style;
    item.dataset.pmListIndent = String(depth);
    if (itemStart !== undefined) {
      item.dataset.pmListStart = String(itemStart);
      if (ordered) item.value = itemStart;
    }
    if (restart !== undefined) item.dataset.pmListRestart = String(restart);
    item.innerHTML = await serializePlateValueToHtml([
      cloneWithoutFlatListMetadata(node),
    ] as unknown as Value);
    level.list.append(item);
    level.lastItem = item;
    if (ordered) {
      level.nextStart = (itemStart ?? level.nextStart ?? 1) + 1;
    }
  }

  return root.innerHTML;
}

async function serializeComposerEditableFragment(
  value: Value,
): Promise<string> {
  const nodes = value as unknown as ComposerSerializationNode[];
  const parts: string[] = [];

  for (let index = 0; index < nodes.length; ) {
    const firstNode = nodes[index];
    if (!firstNode) break;
    if (["hr", "horizontal_rule"].includes(firstNode.type ?? "")) {
      parts.push("<hr>");
      index += 1;
      continue;
    }
    const listRun = isFlatComposerListNode(firstNode);
    let end = index + 1;
    while (end < nodes.length) {
      const nextNode = nodes[end];
      if (
        !nextNode ||
        ["hr", "horizontal_rule"].includes(nextNode.type ?? "") ||
        isFlatComposerListNode(nextNode) !== listRun
      ) {
        break;
      }
      end += 1;
    }
    const run = nodes.slice(index, end);
    parts.push(
      listRun
        ? await serializeFlatComposerListRun(run)
        : normalizeComposerHtmlLists(
            await serializePlateValueToHtml(run as unknown as Value),
          ),
    );
    index = end;
  }

  return parts.join("");
}

function normalizeComposerHtmlLists(html: string): string {
  if (typeof document === "undefined") return html;

  const template = document.createElement("template");
  template.innerHTML = html;

  for (const parent of Array.from(
    template.content.querySelectorAll("body, div, blockquote"),
  )) {
    normalizeListChildren(parent);
  }
  normalizeListChildren(template.content);

  return template.innerHTML;
}

function normalizeListChildren(parent: ParentNode): void {
  const children = Array.from(parent.childNodes);

  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];
    if (!(node instanceof HTMLElement) || !isSerializedListItem(node)) continue;

    const ordered = isOrderedListStyle(node.style.listStyleType);
    const list = document.createElement(ordered ? "ol" : "ul");
    list.style.margin = "0 0 0 20px";
    list.style.padding = "0";
    const items: HTMLElement[] = [];

    for (let next = index; next < children.length; next += 1) {
      const candidate = children[next];
      if (
        !(candidate instanceof HTMLElement) ||
        !isSerializedListItem(candidate)
      ) {
        break;
      }
      if (isOrderedListStyle(candidate.style.listStyleType) !== ordered) break;
      items.push(candidate);
    }

    const firstItem = items[0];
    if (!firstItem) continue;
    parent.insertBefore(list, firstItem);

    for (const item of items) {
      const listItem = document.createElement("li");
      listItem.innerHTML = item.innerHTML;
      list.append(listItem);
      item.remove();
    }
    index += items.length - 1;
  }
}

function isSerializedListItem(element: HTMLElement): boolean {
  return (
    element.tagName === "DIV" &&
    element.style.display === "list-item" &&
    Boolean(element.style.listStyleType)
  );
}

function isOrderedListStyle(listStyleType: string): boolean {
  return [
    "decimal",
    "lower-alpha",
    "lower-roman",
    "upper-alpha",
    "upper-roman",
  ].includes(listStyleType);
}
