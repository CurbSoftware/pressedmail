import type { Value } from "@kit/plate";
import {
  createPlateEmailEmptyValue,
  hasPlateEmailHtmlContent,
  sanitizePlateEmailEditorHtml,
} from "@kit/plate/email-editor";

import { parseComposerHtmlInert } from "@/lib/composer/composer-html-inert";
import { serializeComposerValueToPlainText } from "@/lib/composer/plain-text-serialization";
import {
  getTableCellBorderStyleAttribute,
  parseTableCellBorders,
  type TableCellBorders,
} from "./plate/table-border-styles";

type ComposerNode = {
  type?: string;
  text?: string;
  children?: ComposerNode[];
  [key: string]: unknown;
};

type TextMarks = Record<string, boolean | string | number>;

const BLOCK_TYPES: Record<string, string> = {
  blockquote: "blockquote",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  heading: "h2",
  p: "p",
  paragraph: "p",
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value: unknown): string {
  return escapeHtml(value);
}

function optionalAttribute(name: string, value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  return ` ${name}="${escapeAttribute(value)}"`;
}

function safeLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate) return null;

  if (/^(?:https?:|mailto:|tel:|\/|#)/i.test(candidate)) {
    return candidate;
  }

  return null;
}

function serializeText(node: ComposerNode): string {
  const lines = escapeHtml(node.text ?? "").split("\n");
  let html = lines.join("<br>");

  if (node.code) html = `<code>${html}</code>`;
  if (node.bold) html = `<strong>${html}</strong>`;
  if (node.italic) html = `<em>${html}</em>`;
  if (node.underline) html = `<u>${html}</u>`;
  if (node.strikethrough) html = `<s>${html}</s>`;
  if (node.subscript) html = `<sub>${html}</sub>`;
  if (node.superscript) html = `<sup>${html}</sup>`;
  if (node.kbd) html = `<kbd>${html}</kbd>`;

  const styles: string[] = [];
  if (typeof node.color === "string") styles.push(`color:${node.color}`);
  if (typeof node.backgroundColor === "string") {
    styles.push(`background-color:${node.backgroundColor}`);
  }
  if (typeof node.fontSize === "string" || typeof node.fontSize === "number") {
    styles.push(`font-size:${node.fontSize}`);
  }
  if (typeof node.fontFamily === "string") {
    styles.push(`font-family:${node.fontFamily}`);
  }
  if (node.highlight) styles.push("background-color:#fff3a3");

  return styles.length > 0
    ? `<span style="${escapeAttribute(styles.join(";"))}">${html}</span>`
    : html;
}

function nodeStyles(node: ComposerNode): string {
  const styles: string[] = [];
  if (node.align) styles.push(`text-align:${String(node.align)}`);
  if (node.lineHeight) styles.push(`line-height:${String(node.lineHeight)}`);
  if (node.indent && Number(node.indent) > 0) {
    styles.push(`margin-left:${Number(node.indent) * 24}px`);
  }
  return styles.length > 0
    ? ` style="${escapeAttribute(styles.join(";"))}"`
    : "";
}

function serializeChildren(node: ComposerNode): string {
  return (node.children ?? []).map(serializeNode).join("");
}

function tableCellSpan(node: ComposerNode, key: "colSpan" | "rowSpan") {
  const attributeKey = key === "colSpan" ? "colspan" : "rowspan";
  const attributes =
    node.attributes && typeof node.attributes === "object"
      ? (node.attributes as Record<string, unknown>)
      : undefined;
  const values = [node[key], attributes?.[attributeKey]];

  for (const value of values) {
    const number = Number(value);
    if (Number.isInteger(number) && number > 0) return number;
  }

  return 1;
}

function serializeTable(node: ComposerNode): string {
  const occupiedUntilRow: number[] = [];
  const rows = (node.children ?? []).map((row, rowIndex) => {
    let columnIndex = 0;
    const cells = (row.children ?? []).map((cell) => {
      while ((occupiedUntilRow[columnIndex] ?? 0) > rowIndex) columnIndex++;

      const colSpan = tableCellSpan(cell, "colSpan");
      const rowSpan = tableCellSpan(cell, "rowSpan");
      const borders = getTableCellBorderStyleAttribute(
        cell.borders as TableCellBorders | undefined,
        { includeLeft: columnIndex === 0, includeTop: rowIndex === 0 },
      );
      const tag = cell.type === "th" ? "th" : "td";
      const html = `<${tag}${optionalAttribute("colspan", colSpan > 1 ? colSpan : undefined)}${optionalAttribute("rowspan", rowSpan > 1 ? rowSpan : undefined)} style="${borders};padding:6px">${serializeChildren(cell)}</${tag}>`;

      for (let column = columnIndex; column < columnIndex + colSpan; column++) {
        occupiedUntilRow[column] = Math.max(
          occupiedUntilRow[column] ?? 0,
          rowIndex + rowSpan,
        );
      }
      columnIndex += colSpan;

      return html;
    });

    return `<tr>${cells.join("")}</tr>`;
  });

  return `<table style="border-collapse:collapse">${rows.join("")}</table>`;
}


/**
 * A marker property read from draft HTML, which arrives from IMAP.
 *
 * The parser is the only bound on these: an oversized value would become a node
 * property, and the server's own document validator would then reject the
 * user's next save over it. Anything outside the shape the node can hold is
 * dropped, so the element falls back to what it already displays.
 */
function markerProperty(
  value: string | undefined,
  pattern: RegExp,
): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) {
    return undefined;
  }
  return pattern.test(value) ? value : undefined;
}

// The dash sits last and the slash is unescaped: inside a character class a
// slash needs no escape, and a dash between two class members would otherwise
// become a range endpoint rather than a literal.
const MARKER_DATE = /^[0-9A-Za-z:+. /-]{1,64}$/;
const MARKER_WIDTH = /^[0-9]{1,4}(?:\.[0-9]{1,3})?(?:px|%|em|rem)?$/;
const MARKER_COLOR = /^(?:#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,24}|rgba?\([0-9.,% ]{1,32}\))$/;
const MARKER_ICON = /^.{1,16}$/u;

function serializeNode(node: ComposerNode): string {
  if (typeof node.text === "string") return serializeText(node);

  const type = node.type ?? "p";
  if (type === "table") return serializeTable(node);

  const children = serializeChildren(node);
  const blockTag = BLOCK_TYPES[type];

  if (blockTag) {
    const listStyle =
      typeof node.listStyleType === "string"
        ? ` style="display:list-item;list-style-type:${escapeAttribute(node.listStyleType)};margin-left:${Math.max(1, Number(node.indent) || 1) * 24}px"`
        : nodeStyles(node);
    return `<${blockTag}${listStyle}>${children || "<br>"}</${blockTag}>`;
  }

  switch (type) {
    case "a":
    case "link": {
      const href = safeLink(node.url ?? node.href);
      return href
        ? `<a href="${escapeAttribute(href)}">${children}</a>`
        : children;
    }
    case "hr":
    case "horizontal_rule":
      return "<hr>";
    case "code_block":
      return `<pre style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;font-size:13px;line-height:1.5;overflow-wrap:anywhere;padding:12px;white-space:pre-wrap;word-break:break-word"><code>${children}</code></pre>`;
    case "code_line":
      return `${children}\n`;
    case "signature":
      return `<div data-pm-block="signature"${optionalAttribute("data-account-id", node.accountId)}${optionalAttribute("data-signature-id", node.signatureId)}>${children}</div>`;
    case "attachment": {
      const filename = String(node.filename ?? "Attachment");
      return `<span data-pm-block="attachment"${optionalAttribute("data-filename", filename)}${optionalAttribute("data-size", node.size)}${optionalAttribute("data-attachment-id", node.id)}>${escapeHtml(filename)}</span>`;
    }
    case "ai-suggestion":
      return children;
    case "callout": {
      const background =
        typeof node.backgroundColor === "string"
          ? node.backgroundColor
          : "#f4f4f5";
      const icon =
        typeof node.icon === "string" ? `${escapeHtml(node.icon)} ` : "";
      return `<div data-pm-block="callout"${optionalAttribute("data-background", background)}${optionalAttribute("data-icon", typeof node.icon === "string" ? node.icon : undefined)} style="background-color:${escapeAttribute(background)};padding:12px">${icon}${children}</div>`;
    }
    case "date": {
      const value = typeof node.date === "string" ? node.date : "";
      return `<span data-pm-block="date"${optionalAttribute("data-date", value)}>${escapeHtml(value)}</span>`;
    }
    case "toggle":
      return `<div data-pm-block="toggle">${children}</div>`;
    case "column_group":
      return `<table role="presentation" data-pm-block="column_group" style="table-layout:fixed;width:100%"><tbody><tr>${children}</tr></tbody></table>`;
    case "column":
      return `<td data-pm-block="column"${optionalAttribute("data-width", node.width ? String(node.width) : undefined)}${optionalAttribute("style", node.width ? `width:${String(node.width)}` : undefined)}>${children}</td>`;
    case "tr":
      return `<tr>${children}</tr>`;
    case "td":
    case "th": {
      const borders = getTableCellBorderStyleAttribute(
        node.borders as TableCellBorders | undefined,
      );
      return `<${type} style="${borders};padding:6px">${children}</${type}>`;
    }
    case "img":
    case "image": {
      const src = safeLink(node.url ?? node.src);
      if (!src) return children;
      return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(node.alt ?? "")}"${optionalAttribute("width", node.width)}>`;
    }
    case "file":
    case "audio":
    case "video":
    case "media_embed": {
      const href = safeLink(node.url ?? node.src);
      const label = children || escapeHtml(node.name ?? node.url ?? type);
      return href ? `<a href="${escapeAttribute(href)}">${label}</a>` : label;
    }
    case "mention":
      return escapeHtml(`@${String(node.value ?? node.name ?? "")}`);
    case "ul":
    case "ol":
    case "li":
      return `<${type}>${children}</${type}>`;
    default:
      return children;
  }
}

function positiveInteger(value: string | undefined): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function unwrapListItemChildren(nodes: ComposerNode[]): ComposerNode[] {
  return nodes.flatMap((node) => {
    if (
      ["p", "h1", "h2", "h3", "blockquote"].includes(node.type ?? "") &&
      Array.isArray(node.children)
    ) {
      return node.children as ComposerNode[];
    }
    return [node];
  });
}

function domListToComposerNodes(
  list: HTMLElement,
  inheritedIndent = 1,
  marks: TextMarks = {},
): ComposerNode[] {
  const ordered = list.tagName.toLowerCase() === "ol";
  const defaultStyle = ordered ? "decimal" : "disc";
  const listStyle = list.style.listStyleType || defaultStyle;
  const listStart =
    positiveInteger(list.getAttribute("start") ?? undefined) ?? 1;
  const result: ComposerNode[] = [];
  const items = Array.from(list.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.tagName.toLowerCase() === "li",
  );

  items.forEach((item, index) => {
    const style = item.dataset.pmListStyle || listStyle;
    const indent =
      positiveInteger(item.dataset.pmListIndent) ?? inheritedIndent;
    const start =
      positiveInteger(item.dataset.pmListStart) ??
      (ordered ? listStart + index : undefined);
    const restart = positiveInteger(item.dataset.pmListRestart);
    const contentNodes = Array.from(item.childNodes)
      .filter(
        (child) =>
          !(child instanceof HTMLElement) ||
          !["ol", "ul"].includes(child.tagName.toLowerCase()),
      )
      .flatMap((child) =>
        domNodeToComposerNodes(child, elementTextMarks(item, marks)),
      );
    const children = unwrapListItemChildren(contentNodes);

    result.push({
      type: "p",
      listStyleType: style,
      indent,
      ...(start !== undefined ? { listStart: start } : {}),
      ...(restart !== undefined ? { listRestartPolite: restart } : {}),
      children: children.length > 0 ? children : [{ text: "" }],
    });

    for (const nested of Array.from(item.children)) {
      if (
        nested instanceof HTMLElement &&
        ["ol", "ul"].includes(nested.tagName.toLowerCase())
      ) {
        result.push(
          ...domListToComposerNodes(
            nested,
            indent + 1,
            elementTextMarks(nested, elementTextMarks(item, marks)),
          ),
        );
      }
    }
  });

  return result;
}

/** Preserve inherited authored typography in the small Free HTML parser. */
function elementTextMarks(node: HTMLElement, inherited: TextMarks): TextMarks {
  const marks = { ...inherited };
  for (const property of ["color", "fontFamily", "fontSize"] as const) {
    const value = node.style[property];
    if (value && value !== "inherit") marks[property] = value;
  }
  return marks;
}

function domNodeToComposerNodes(
  node: Node,
  marks: TextMarks = {},
): ComposerNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return [{ text: node.textContent ?? "", ...marks }];
  }
  if (!(node instanceof HTMLElement)) return [];

  const tag = node.tagName.toLowerCase();
  const nextMarks = elementTextMarks(node, marks);
  if (tag === "ol" || tag === "ul") {
    return domListToComposerNodes(node, 1, nextMarks);
  }
  if (tag === "strong" || tag === "b") nextMarks.bold = true;
  if (tag === "em" || tag === "i") nextMarks.italic = true;
  if (tag === "u") nextMarks.underline = true;
  if (tag === "s" || tag === "strike" || tag === "del") {
    nextMarks.strikethrough = true;
  }
  if (tag === "code") nextMarks.code = true;

  if (
    // An authoring marker outranks the tag. A marked span is a date or an
    // attachment, not inline text, and flattening it here would drop the marker
    // before anything read it: that was why a saved attachment came back as its
    // filename alone.
    !node.dataset.pmBlock &&
    [
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "strike",
      "del",
      "code",
      "span",
    ].includes(tag)
  ) {
    return Array.from(node.childNodes).flatMap((child) =>
      domNodeToComposerNodes(child, nextMarks),
    );
  }

  if (tag === "br") return [{ text: "\n", ...nextMarks }];

  const children = Array.from(node.childNodes).flatMap((child) =>
    domNodeToComposerNodes(child, nextMarks),
  );
  const pmBlock = node.dataset.pmBlock;

  if (node.style.display === "list-item" && node.style.listStyleType) {
    const indentFromMargin = Math.max(
      1,
      Math.round(Number.parseFloat(node.style.marginLeft || "24") / 24),
    );
    const listStart = positiveInteger(node.dataset.pmListStart);
    const listRestartPolite = positiveInteger(node.dataset.pmListRestart);
    return [
      {
        type: "p",
        listStyleType: node.dataset.pmListStyle || node.style.listStyleType,
        indent: positiveInteger(node.dataset.pmListIndent) ?? indentFromMargin,
        ...(listStart !== undefined ? { listStart } : {}),
        ...(listRestartPolite !== undefined ? { listRestartPolite } : {}),
        children: unwrapListItemChildren(children),
      },
    ];
  }

  if (pmBlock === "signature") {
    return [
      {
        type: "signature",
        accountId: node.dataset.accountId,
        signatureId: node.dataset.signatureId,
        children,
      },
    ];
  }
  if (pmBlock === "quote") {
    // Legacy drafts only. Replies have emitted a plain <blockquote> since the
    // bespoke quote node was removed; this keeps an old saved draft opening as
    // an ordinary, editable blockquote instead of an unknown element.
    return [{ type: "blockquote", children }];
  }
  if (pmBlock === "attachment") {
    return [
      {
        type: "attachment",
        filename: node.dataset.filename ?? node.textContent ?? "Attachment",
        id: node.dataset.attachmentId,
        children: [{ text: "" }],
      },
    ];
  }

  // The block markers a Rich Text draft carries so it reopens as the blocks it
  // was written with. The visible HTML underneath each one is what a recipient
  // client renders; these attributes are what the composer reads back.
  if (pmBlock === "toggle") {
    return [{ type: "toggle", children }];
  }
  if (pmBlock === "callout") {
    return [
      {
        type: "callout",
        ...(markerProperty(node.dataset.background, MARKER_COLOR)
          ? { backgroundColor: node.dataset.background }
          : {}),
        ...(markerProperty(node.dataset.icon, MARKER_ICON)
          ? { icon: node.dataset.icon }
          : {}),
        children,
      },
    ];
  }
  if (pmBlock === "date") {
    return [
      {
        type: "date",
        date:
          markerProperty(node.dataset.date, MARKER_DATE) ??
          (node.textContent ?? "").slice(0, 64),
        children: [{ text: "" }],
      },
    ];
  }
  if (pmBlock === "column_group") {
    // The columns are written inside a real table row, because that is what a
    // recipient client needs, but the authoring tree holds them directly under
    // the group. Unwrap the row rather than reintroducing it as a node.
    const columns = children.flatMap((child) =>
      child.type === "tr" ? (child.children ?? []) : [child],
    );
    return [{ type: "column_group", children: columns }];
  }
  if (pmBlock === "column") {
    return [
      {
        type: "column",
        ...(markerProperty(node.dataset.width, MARKER_WIDTH)
          ? { width: node.dataset.width }
          : {}),
        children,
      },
    ];
  }

  if (tag === "a") {
    return [{ type: "a", url: node.getAttribute("href") ?? "", children }];
  }
  if (tag === "img") {
    return [
      {
        type: "img",
        url: node.getAttribute("src") ?? "",
        alt: node.getAttribute("alt") ?? "",
        children: [{ text: "" }],
      },
    ];
  }
  if (tag === "hr") return [{ type: "hr", children: [{ text: "" }] }];

  if (tag === "table" || tag === "tbody" || tag === "thead") {
    if (tag !== "table") return children;
    return [{ type: "table", children }];
  }
  if (tag === "tr") return [{ type: "tr", children }];
  if (tag === "td" || tag === "th") {
    const borders = parseTableCellBorders(node);
    const colspan = positiveInteger(node.getAttribute("colspan") ?? undefined);
    const rowspan = positiveInteger(node.getAttribute("rowspan") ?? undefined);

    return [
      {
        type: tag,
        ...(borders ? { borders } : {}),
        ...(colspan !== undefined || rowspan !== undefined
          ? {
              attributes: {
                ...(colspan !== undefined ? { colspan } : {}),
                ...(rowspan !== undefined ? { rowspan } : {}),
              },
            }
          : {}),
        children: children.length > 0 ? children : [{ text: "" }],
      },
    ];
  }

  const type = tag === "div" ? "p" : tag;
  if (["p", "h1", "h2", "h3", "blockquote", "pre", "li"].includes(type)) {
    return [
      {
        type: type === "pre" ? "code_block" : type,
        children: children.length > 0 ? children : [{ text: "" }],
      },
    ];
  }

  return children;
}

export type PressedMailComposerValue = Value;

export function deserializeLegacyHtmlToPlateValue(
  html: string,
  editorApi?: { html: { deserialize: (opts: { element: string }) => Value } },
): Value {
  if (!hasPlateEmailHtmlContent(html)) return createPlateEmailEmptyValue();
  if (editorApi) {
    try {
      return editorApi.html.deserialize({
        element: parseComposerHtmlInert(html) as unknown as string,
      });
    } catch {
      // Use the small browser parser below when the live editor rejects input.
    }
  }
  return deserializeLegacyHtmlStatic(html);
}

export function deserializeLegacyHtmlStatic(html: string): Value {
  if (!hasPlateEmailHtmlContent(html)) return createPlateEmailEmptyValue();

  try {
    const document = new DOMParser().parseFromString(html, "text/html");
    const value = domNodeToComposerNodes(document.body);
    return (value.length > 0 ? value : createPlateEmailEmptyValue()) as Value;
  } catch {
    return createPlateEmailEmptyValue();
  }
}

export function stripEditorAttributes(html: string): string {
  return sanitizePlateEmailEditorHtml(html);
}

export async function serializePlateValueToHtml(value: Value): Promise<string> {
  return stripEditorAttributes(
    (value as unknown as ComposerNode[]).map(serializeNode).join(""),
  );
}

export function serializePlateValueToPlainText(value: Value): string {
  return serializeComposerValueToPlainText(value);
}
