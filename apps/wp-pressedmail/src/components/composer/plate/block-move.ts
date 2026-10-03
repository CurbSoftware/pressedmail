import type { TElement } from "@kit/plate";
import {
  expandListItemsWithChildren,
  getNextList,
  getPreviousList,
} from "@kit/plate/list";
import type { PlateEditor } from "@kit/plate/react";

/** Move within the current container, carrying an indented list item's children. */
export function getBlockMoveTarget(
  editor: PlateEditor,
  element: TElement,
  direction: -1 | 1,
) {
  const path = editor.api.findPath(element);
  const live = path?.length ? editor.api.node<TElement>(path) : undefined;
  if (!path || !live) return null;
  element = live[0];
  const parent = path.slice(0, -1);
  const neighbor = element.listStyleType
    ? (direction === -1 ? getPreviousList : getNextList)(
        editor,
        [element, path],
        { eqIndent: true },
      )
    : editor.api.node([...parent, path[path.length - 1]! + direction]);
  if (!neighbor || !("children" in neighbor[0])) return null;
  const moving = expandListItemsWithChildren(editor, [[element, path]]);
  const neighbors = expandListItemsWithChildren(editor, [
    neighbor as [TElement, number[]],
  ]);
  const to =
    direction === -1 ? neighbor[1] : neighbors[neighbors.length - 1]![1];
  return { parent, moving: moving.map(([node]) => node), to };
}

export function moveBlock(
  editor: PlateEditor,
  element: TElement,
  direction: -1 | 1,
) {
  const target = getBlockMoveTarget(editor, element, direction);
  if (!target || editor.dom.readOnly) return;
  editor.tf.moveNodes({
    at: target.parent,
    to: target.to,
    match: (node) => target.moving.includes(node as TElement),
  });
}

// Blocks that exist only to hold other blocks. An emptied one is removed;
// any other emptied container (column, table cell) gets a blank paragraph so
// its layout survives.
const REMOVE_WHEN_EMPTY = new Set(["blockquote"]);

function takeBlock(editor: PlateEditor, element: TElement) {
  const path = editor.api.findPath(element);
  // The menu's element can be a stale copy after a convert; use the live node.
  const live = path?.length ? editor.api.node<TElement>(path) : undefined;
  if (!path || !live || editor.dom.readOnly) return null;
  const moving = expandListItemsWithChildren(editor, [live]).map(
    ([node]) => node,
  );
  return { path, parent: path.slice(0, -1), moving };
}

function refillIfEmpty(editor: PlateEditor, at: number[]) {
  const entry = at.length ? editor.api.node<TElement>(at) : null;
  if (!entry || entry[0].children.some((child) => "type" in child)) return;
  if (REMOVE_WHEN_EMPTY.has(entry[0].type)) {
    editor.tf.removeNodes({ at });
    refillIfEmpty(editor, at.slice(0, -1));
    return;
  }
  editor.tf.insertNodes(editor.api.create.block(), { at: [...at, 0] });
}

/** Nested blocks can move out to sit directly above their top-level ancestor. */
export function canMoveBlockOut(editor: PlateEditor, element: TElement) {
  return (editor.api.findPath(element)?.length ?? 0) > 1;
}

export function moveBlockOut(editor: PlateEditor, element: TElement) {
  const taken = takeBlock(editor, element);
  if (!taken || taken.path.length < 2) return;
  const top = taken.path[0]!;
  editor.tf.withoutNormalizing(() => {
    editor.tf.moveNodes({
      at: taken.parent,
      to: [top],
      match: (node) => taken.moving.includes(node as TElement),
    });
    // The old container shifted down by however many blocks moved above it.
    refillIfEmpty(editor, [top + taken.moving.length, ...taken.parent.slice(1)]);
  });
}

/**
 * Only text blocks convert. Containers (quotes, tables, code) hold blocks, and
 * voids (images, rules, media) carry an empty text leaf but no text to keep.
 */
export function canConvertBlock(editor: PlateEditor, element: TElement) {
  return (
    !editor.api.isVoid(element) &&
    element.children.some((child) => "text" in child)
  );
}

/**
 * A block already inside a quote cannot become one: setBlockType sees the
 * enclosing quote and does nothing, so the menu must not offer it.
 */
export function isInsideQuote(editor: PlateEditor, element: TElement) {
  const path = editor.api.findPath(element);
  return !!path && editor.api.above({
    at: path,
    match: { type: editor.getType("blockquote") },
  }) !== undefined;
}

/** A quote can be removed as a whole, leaving its text where it was. */
export function canUnwrapBlock(element: TElement) {
  return element.type === "blockquote";
}

export function unwrapBlock(editor: PlateEditor, element: TElement) {
  const path = editor.api.findPath(element);
  if (!path?.length || editor.dom.readOnly) return;
  editor.tf.unwrapNodes({ at: path });
}

export function deleteBlock(editor: PlateEditor, element: TElement) {
  const taken = takeBlock(editor, element);
  if (!taken) return;
  editor.tf.withoutNormalizing(() => {
    editor.tf.removeNodes({
      at: taken.parent,
      match: (node) => taken.moving.includes(node as TElement),
    });
    refillIfEmpty(editor, taken.parent);
  });
  if (editor.children.length === 0) {
    editor.tf.insertNodes(editor.api.create.block(), { at: [0] });
  }
}
