/**
 * The Insert button block (Free and Pro): a void block that keeps a button's
 * settings on the node. The static component writes the table, and the parser
 * below reads it back from a reopened draft, a paste or an import.
 *
 *   button → <table data-pm-block="button"> with one coloured cell and a link
 *
 * See button-fields.ts for the markup and why it is a table.
 */

import { createSlatePlugin, type TElement } from "@kit/plate";

import {
  BUTTON_BLOCK,
  BUTTON_KEY,
  normalizeButton,
  readButtonSettings,
  type ButtonInput,
  type ButtonSettings,
} from "./button-fields";

export { BUTTON_KEY };

export interface TButtonElement extends TElement, ButtonSettings {
  type: typeof BUTTON_KEY;
}

export function createButtonNode(patch: ButtonInput = {}): TButtonElement {
  return { type: BUTTON_KEY, ...normalizeButton(patch), children: [{ text: "" }] };
}

export const ButtonPlugin = createSlatePlugin({
  key: BUTTON_KEY,
  node: { isElement: true, isVoid: true },
  parsers: {
    html: {
      deserializer: {
        rules: [{ validNodeName: "TABLE", validAttribute: { "data-pm-block": [BUTTON_BLOCK] } }],
        parse: ({ element }: { element: HTMLElement }) => createButtonNode(readButtonSettings(element)),
      },
    },
  },
});
