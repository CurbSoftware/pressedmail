/**
 * Quoted mail: the header line and the blockquote a reply or forward brings.
 *
 * That text is someone else's. The reply and forward builders mark it
 * (compose-utils.ts) and this plugin carries the mark as a `quoted` prop on
 * the node, out of the HTML the editor reads and back into the HTML it writes
 * (the static serializer and the live DOM alike). Two readers depend on it:
 * the field plugin leaves `{{...}}` under a quoted node as text, and the
 * send-time scrub finds the quote in any language
 * (TemplateVariables::history_spans, PHP).
 *
 * A blockquote the author makes carries no mark, and a paragraph lifted out
 * of the quote has no quoted ancestor any more: both are the author's.
 */
import {
  createSlatePlugin,
  ElementApi,
  KEYS,
  type Path,
  type SlateEditor,
} from "@kit/plate";

import { QUOTED_ATTRIBUTE } from "@/lib/composer/quote-headers";

export const QUOTED_KEY = "quoted";

/** Whether the node at `path` is quoted mail, or sits inside it. */
export function isQuoted(editor: SlateEditor, path: Path | undefined): boolean {
  return (
    !!path &&
    !!editor.api.above({
      at: path,
      match: (node) => ElementApi.isElement(node) && !!node[QUOTED_KEY],
    })
  );
}

export const QuotedPlugin = createSlatePlugin({
  key: QUOTED_KEY,
  parsers: {
    html: {
      deserializer: {
        isElement: true,
        rules: [
          { validNodeName: "BLOCKQUOTE", validAttribute: { [QUOTED_ATTRIBUTE]: "body" } },
          // What other mail clients write, and what the server already reads as history.
          { validNodeName: "BLOCKQUOTE", validAttribute: { type: "cite" } },
          // The serializer writes a paragraph as a div.
          { validNodeName: ["P", "DIV"], validAttribute: { [QUOTED_ATTRIBUTE]: "header" } },
        ],
        parse: ({ editor, element }) =>
          element.nodeName === "BLOCKQUOTE"
            ? { type: editor.getType(KEYS.blockquote), [QUOTED_KEY]: "body" }
            : {
                type: editor.getType(KEYS.p),
                [QUOTED_KEY]: "header",
                ...(element.style.textAlign ? { align: element.style.textAlign } : {}),
              },
      },
    },
  },
  inject: {
    nodeProps: {
      nodeKey: QUOTED_KEY,
      // The attributes and nothing else: Plate's own props for a node key are
      // a class and a `quoted: body` style declaration, which is not CSS.
      transformProps: ({ nodeValue }) =>
        nodeValue === "body"
          ? { type: "cite", [QUOTED_ATTRIBUTE]: "body" }
          : nodeValue === "header"
            ? { [QUOTED_ATTRIBUTE]: "header" }
            : {},
    },
    targetPlugins: [KEYS.p, KEYS.blockquote],
  },
}).overrideEditor(({ editor, tf: { normalizeNode } }) => ({
  transforms: {
    normalizeNode(entry, options) {
      const [node, path] = entry;
      // Enter at either end of the header line leaves an empty paragraph that
      // copied its mark. Nothing in it is quoted: what is typed there is the
      // author's, so fields work and the scrub applies.
      if (
        ElementApi.isElement(node) &&
        node[QUOTED_KEY] === "header" &&
        editor.api.isEmpty(node)
      ) {
        editor.tf.unsetNodes(QUOTED_KEY, { at: path });
        return;
      }
      normalizeNode(entry, options);
    },
  },
}));
