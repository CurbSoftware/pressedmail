import { createTSlatePlugin } from "@kit/plate";
import type { Value } from "@kit/plate";

import { splitSoftBreakParagraphs } from "./lib/split-soft-breaks";

type HtmlDeserialize = (opts: { element: string }) => Value;

/**
 * Live-editor plugin that wraps `editor.api.html.deserialize` so every
 * `<br>`/`\n` soft break in deserialized HTML is promoted into its own
 * block. This is the single source of truth covering paste, initial-content
 * load (`hydrateInitialHtml` calls `editor.api.html.deserialize`), and any
 * HTML fragment inserted into the editor, so each line can carry
 * independent block-level styling (alignment, line-height, indent).
 *
 * Idempotent: re-running the split on already-split blocks is a no-op, so it
 * composes safely with the static-kit deserialize in
 * `deserializeLegacyHtmlStatic`.
 */
export const SplitSoftBreaksPlugin = createTSlatePlugin({
  key: "pmSplitSoftBreaks",
}).extendEditorApi(({ editor }) => {
  const original = (
    editor.api as { html: { deserialize: HtmlDeserialize } }
  ).html.deserialize;

  return {
    html: {
      deserialize: (opts: { element: string }) =>
        splitSoftBreakParagraphs(original(opts)) as Value,
    },
  };
});
