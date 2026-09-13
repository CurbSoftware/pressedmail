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
  if (!path?.length) return null;
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
