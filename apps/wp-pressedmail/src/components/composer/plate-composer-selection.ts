import { NodeApi, TextApi, type Point } from "@kit/plate";
import type { PlateEditor } from "@kit/plate/react";

/**
 * A caret position kept as a path ([0, 0] for "the start", or a point saved
 * before a dialog opened) means "a place in a text node" only while the
 * document still looks the way it did. Open a table, a column group, a callout
 * or a quote first and that path lands on an element instead. Slate then
 * throws "Cannot get the leaf node at path ... because it refers to a non-leaf
 * node" from a timer after the next render, uncaught, and the caret is gone.
 *
 * Every place that puts a stored point back goes through here, so the point
 * that reaches the editor always sits in a text node of the document as it is
 * now.
 */
export type CaretRange = { anchor: Point; focus: Point };

/** The point itself when it is in a text node; else the first text under it, or the start of the document. */
export function toTextPoint(editor: PlateEditor, point: Point): Point | null {
  const node = NodeApi.get(editor, point.path);
  if (node && TextApi.isText(node)) {
    return { path: point.path, offset: Math.min(point.offset, node.text.length) };
  }
  return (node ? editor.api.start(point.path) : undefined) ?? editor.api.start([]) ?? null;
}

/** Put the caret (or the range) at `range`, moved onto text where it is not. Does nothing in a document with no text. */
export function selectInText(editor: PlateEditor, range: CaretRange): void {
  const anchor = toTextPoint(editor, range.anchor);
  const focus = toTextPoint(editor, range.focus);
  if (anchor && focus) editor.tf.select({ anchor, focus });
}
