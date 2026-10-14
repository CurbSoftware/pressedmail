import type { CSSProperties, TdHTMLAttributes } from "react";

import { buttonParts, declarationsToStyle, type ButtonInput } from "./button-fields";

/**
 * The button's email markup as React: the table body, and the attributes of the
 * table itself. The static serializer and the live editor both render these, so
 * the editor draws exactly what is sent and the DOM fallback in
 * `getComposerDomHtml` sends what the serializer would.
 */
export function buttonTableAttributes(element: ButtonInput) {
  const parts = buttonParts(element);
  // The table's width is its attribute, which every client reads. SlateElement
  // puts position:relative under the style it is given; clearing it here keeps
  // the sent table the same in both editions.
  return { ...parts.tableAttributes, style: { position: undefined, ...declarationsToStyle(parts.tableStyle) } as CSSProperties };
}

export function ButtonTableBody({ element }: { element: ButtonInput }) {
  const parts = buttonParts(element);
  return (
    <tbody>
      <tr>
        <td
          {...(parts.cellAttributes as TdHTMLAttributes<HTMLTableCellElement>)}
          style={declarationsToStyle(parts.cellStyle) as CSSProperties}>
          <a {...parts.linkAttributes} style={declarationsToStyle(parts.linkStyle) as CSSProperties}>
            {parts.label}
          </a>
        </td>
      </tr>
    </tbody>
  );
}
