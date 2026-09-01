import type { Value } from "@kit/plate";

type ComposerNode = {
  type?: string;
  text?: string;
  children?: ComposerNode[];
  url?: unknown;
  href?: unknown;
  src?: unknown;
  alt?: unknown;
  name?: unknown;
  filename?: unknown;
  value?: unknown;
  date?: unknown;
  indent?: unknown;
  listStyleType?: unknown;
  listStart?: unknown;
  checked?: unknown;
  texExpression?: unknown;
  png?: unknown;
  [key: string]: unknown;
};

const ORDERED_LIST_STYLES = new Set([
  "decimal",
  "lower-alpha",
  "lower-latin",
  "lower-roman",
  "upper-alpha",
  "upper-latin",
  "upper-roman",
]);

const INLINE_NODE_TYPES = new Set([
  "a",
  "ai-suggestion",
  "attachment",
  "audio",
  "date",
  "file",
  "image",
  "img",
  "link",
  "media_embed",
  "mention",
  "video",
]);

const BLOCK_NODE_TYPES = new Set([
  "blockquote",
  "callout",
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
  "ol",
  "p",
  "paragraph",
  "quote",
  "signature",
  "table",
  "td",
  "th",
  "tr",
  "ul",
]);

function stringProperty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function inlineChildren(node: ComposerNode): string {
  return (node.children ?? []).map(serializeInlineNode).join("");
}

function labelWithUrl(label: string, url: string): string {
  if (!url) return label;
  if (!label || label === url) return url;
  return `${label} <${url}>`;
}

function serializeInlineNode(node: ComposerNode): string {
  if (typeof node.text === "string") return node.text;

  const type = node.type ?? "";
  const children = inlineChildren(node);

  switch (type) {
    case "a":
    case "link":
      return labelWithUrl(
        children,
        stringProperty(node.url) || stringProperty(node.href),
      );
    case "img":
    case "image":
      return labelWithUrl(
        stringProperty(node.alt) || children,
        stringProperty(node.url) || stringProperty(node.src),
      );
    case "file":
    case "audio":
    case "video":
    case "media_embed":
      return labelWithUrl(
        children || stringProperty(node.name) || stringProperty(node.filename),
        stringProperty(node.url) || stringProperty(node.src),
      );
    case "attachment":
      return (
        stringProperty(node.filename) ||
        stringProperty(node.name) ||
        children ||
        "Attachment"
      );
    case "mention": {
      const mention =
        stringProperty(node.value) || stringProperty(node.name) || children;
      return mention && !mention.startsWith("@") ? `@${mention}` : mention;
    }
    case "date":
      return stringProperty(node.date) || children;
    case "inline_equation":
      return stringProperty(node.texExpression) || children || "[equation]";
    default:
      return children;
  }
}

function serializeTableRow(node: ComposerNode): string {
  const cells = node.children ?? [];
  return cells
    .map((cell) => serializeBlockSequence(cell.children ?? [], " "))
    .join("\t");
}

function serializeStructuralList(node: ComposerNode, depth = 0): string {
  const ordered = node.type === "ol";
  let number = Number.isFinite(Number(node.listStart))
    ? Number(node.listStart)
    : 1;
  const lines: string[] = [];

  for (const child of node.children ?? []) {
    if (child.type !== "li") {
      const fallback = serializeBlockNode(child);
      if (fallback) lines.push(fallback);
      continue;
    }

    const contentChildren: ComposerNode[] = [];
    const nestedLists: ComposerNode[] = [];
    for (const itemChild of child.children ?? []) {
      if (itemChild.type === "ul" || itemChild.type === "ol") {
        nestedLists.push(itemChild);
      } else if (itemChild.type === "lic") {
        contentChildren.push(...(itemChild.children ?? []));
      } else {
        contentChildren.push(itemChild);
      }
    }

    const content = serializeBlockSequence(contentChildren, " ");
    const marker = ordered ? `${number}.` : "-";
    lines.push(`${"  ".repeat(depth)}${marker}${content ? ` ${content}` : ""}`);
    if (ordered) number += 1;

    for (const nested of nestedLists) {
      const nestedText = serializeStructuralList(nested, depth + 1);
      if (nestedText) lines.push(nestedText);
    }
  }

  return lines.join("\n");
}

function quoteText(text: string): string {
  return text
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}

function serializeBlockNode(node: ComposerNode): string {
  if (typeof node.text === "string") return node.text;

  switch (node.type) {
    case "blockquote":
    case "quote":
      return quoteText(serializeBlockSequence(node.children ?? [], "\n"));
    case "code_block":
      return (node.children ?? [])
        .map((child) => inlineChildren(child) || serializeInlineNode(child))
        .join("\n");
    case "code_line":
      return inlineChildren(node);
    case "hr":
    case "horizontal_rule":
      return "---";
    case "signature": {
      const signature = serializeBlockSequence(node.children ?? [], "\n")
        .split("\n")
        .filter((line, index) => index !== 0 || !/^--\s*$/.test(line))
        .join("\n");
      return signature ? `-- \n${signature}` : "-- ";
    }
    case "equation":
      return stringProperty(node.texExpression) || "[Empty equation]";
    case "excalidraw": {
      const image = stringProperty(node.png);
      return image ? labelWithUrl("Drawing", image) : "[Drawing]";
    }
    case "table":
      return (node.children ?? [])
        .filter((child) => child.type === "tr")
        .map(serializeTableRow)
        .join("\n");
    case "tr":
      return serializeTableRow(node);
    case "td":
    case "th":
      return serializeBlockSequence(node.children ?? [], " ");
    case "ul":
    case "ol":
      return serializeStructuralList(node);
    case "column_group":
      return (node.children ?? [])
        .map((child) => serializeBlockSequence(child.children ?? [], " "))
        .join("\t");
    default: {
      if (INLINE_NODE_TYPES.has(node.type ?? "")) {
        return serializeInlineNode(node);
      }

      const children = node.children ?? [];
      const containsBlocks = children.some((child) => !isInlineLike(child));
      return containsBlocks
        ? serializeBlockSequence(children, "\n")
        : children.map(serializeInlineNode).join("");
    }
  }
}

function isInlineLike(node: ComposerNode): boolean {
  if (typeof node.text === "string") return true;
  if (INLINE_NODE_TYPES.has(node.type ?? "")) return true;
  if (BLOCK_NODE_TYPES.has(node.type ?? "")) return false;
  return (node.children ?? []).every(isInlineLike);
}

function isFlatListNode(node: ComposerNode): boolean {
  return typeof node.listStyleType === "string" && node.listStyleType !== "";
}

function isOrderedFlatListNode(node: ComposerNode): boolean {
  return ORDERED_LIST_STYLES.has(String(node.listStyleType));
}

function serializeBlockSequence(
  nodes: ComposerNode[],
  defaultSeparator = "\n\n",
): string {
  const blocks: Array<{ flatList: boolean; text: string }> = [];
  const orderedCounters = new Map<number, number>();

  for (const node of nodes) {
    if (isFlatListNode(node)) {
      const depth = Math.max(1, Number(node.indent) || 1);
      const ordered = isOrderedFlatListNode(node);
      let marker = "-";

      if (String(node.listStyleType) === "todo") {
        marker = node.checked ? "- [x]" : "- [ ]";
      } else if (ordered) {
        const explicitStart = Number(node.listStart);
        const number = Number.isFinite(explicitStart)
          ? explicitStart
          : (orderedCounters.get(depth) ?? 0) + 1;
        orderedCounters.set(depth, number);
        marker = `${number}.`;
      } else {
        orderedCounters.delete(depth);
      }

      for (const key of orderedCounters.keys()) {
        if (key > depth) orderedCounters.delete(key);
      }

      blocks.push({
        flatList: true,
        text: `${"  ".repeat(depth - 1)}${marker} ${inlineChildren(node)}`.trimEnd(),
      });
      continue;
    }

    orderedCounters.clear();
    blocks.push({ flatList: false, text: serializeBlockNode(node) });
  }

  let output = "";
  let previous: { flatList: boolean; text: string } | undefined;
  for (const block of blocks) {
    if (!block.text && blocks.length === 1) continue;
    if (output) {
      output += previous?.flatList && block.flatList ? "\n" : defaultSeparator;
    }
    output += block.text;
    previous = block;
  }

  return output;
}

/**
 * Convert a composer Plate value to readable RFC 5322 text-body conventions.
 * This deliberately preserves structure without leaking Markdown formatting.
 */
export function serializeComposerValueToPlainText(value: Value): string {
  return serializeBlockSequence(value as unknown as ComposerNode[])
    .replace(/\r\n?/g, "\n")
    .replace(/^\n+|\n+$/g, "");
}
