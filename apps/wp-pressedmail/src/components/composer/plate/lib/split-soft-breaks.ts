import type { Descendant, TElement, TText, Value } from "@kit/plate";

/**
 * Block element types whose in-block `\n` soft breaks should be promoted to
 * separate sibling blocks so each line can carry independent block-level
 * styling (alignment, line-height, indent).
 */
const SPLITTABLE_BLOCK_TYPES = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

/**
 * Element types whose inner newlines are semantic and must NOT be split or
 * recursed into (code blocks, list items, preformatted text).
 */
const SKIP_TYPES = new Set(["code_block", "code_line", "li", "pre"]);

const isText = (node: Descendant): node is TText =>
  typeof (node as { text?: unknown }).text === "string";

/**
 * Group a block's inline children into visual lines, splitting text leaves
 * that contain `\n`. Inline elements (links, mentions) stay attached to the
 * line they fall on and are never split. Each `\n` starts a new line; an
 * empty result line represents a blank line.
 */
function groupChildrenByLine(children: Descendant[]): Descendant[][] {
  const lines: Descendant[][] = [];
  let current: Descendant[] = [];
  lines.push(current);

  for (const child of children) {
    if (
      isText(child) &&
      typeof child.text === "string" &&
      child.text.includes("\n")
    ) {
      const parts = child.text.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          current = [];
          lines.push(current);
        }
        const part = parts[i];
        if (part) {
          current.push({ ...child, text: part });
        }
      }
    } else {
      current.push(child);
    }
  }

  return lines;
}

const isLineEmpty = (line: Descendant[]): boolean =>
  line.length === 0 ||
  line.every((node) => isText(node) && (node as TText).text === "");

/**
 * Drop trailing empty lines (the common `<p>text<br></p>` terminator) while
 * always keeping at least one line so an empty paragraph stays a single
 * empty block.
 */
function trimTrailingEmptyLines(lines: Descendant[][]): Descendant[][] {
  const result = [...lines];
  while (result.length > 1) {
    const last = result[result.length - 1];
    if (last && isLineEmpty(last)) {
      result.pop();
    } else {
      break;
    }
  }
  return result;
}

function rebuildBlock(parent: TElement, line: Descendant[]): TElement {
  const children = line.length > 0 ? line : [{ text: "" }];
  const { children: _omit, ...props } = parent;
  return { ...props, children } as TElement;
}

function splitBlock(node: TElement): TElement[] {
  const lines = trimTrailingEmptyLines(groupChildrenByLine(node.children ?? []));
  return lines.map((line) => rebuildBlock(node, line));
}

function processNode(node: Descendant): Descendant | Descendant[] {
  if (isText(node)) return node;

  if (SKIP_TYPES.has(node.type as string)) return node;

  if (SPLITTABLE_BLOCK_TYPES.has(node.type as string)) {
    return splitBlock(node);
  }

  const newChildren: Descendant[] = [];
  for (const child of (node as TElement).children ?? []) {
    const result = processNode(child);
    if (Array.isArray(result)) {
      newChildren.push(...result);
    } else {
      newChildren.push(result);
    }
  }
  return { ...(node as TElement), children: newChildren };
}

/**
 * Promote every in-block `\n` soft break (produced when Plate deserializes
 * `<br>` elements, see `cleanHtmlBrElements` in `@platejs/core`) into a
 * separate sibling block. Block-level props (textAlign, lineHeight, indent,
 * …) are copied onto every split child so the split lines keep their style
 * and can then be restyled independently.
 *
 * Applies to splittable block types (paragraph + headings) at any depth.
 * Code blocks, list items and preformatted text are left untouched because
 * their newlines are semantic.
 */
export function splitSoftBreakParagraphs(value: Value): Value {
  const out: Descendant[] = [];

  for (const node of value as unknown as Descendant[]) {
    const result = processNode(node);
    if (Array.isArray(result)) {
      out.push(...result);
    } else {
      out.push(result);
    }
  }

  return out as unknown as Value;
}
