import { createSlatePlugin } from "@kit/plate";

import { EDITOR_DECORATION_SELECTOR } from "@/services/email-safe-html.service";

/**
 * Keep editor-only chrome out of the clipboard.
 *
 * Slate builds clipboard data by cloning the DOM range and scrubbing exactly
 * one thing, `[data-slate-zero-width]` (slate-dom `setFragmentData`). Every
 * other node inside the selection is copied verbatim, so the "Signature" badge
 * and the quote's expand button came along with the text. `user-select: none`
 * does not help: Chrome still copies text inside a non-selectable element when
 * the selection spans it.
 *
 * The same decorations are already stripped at send time
 * (`prepareEmailHtmlForSend`) and in the DOM-fallback capture
 * (`getComposerDomHtml`). This is the third and last place they escape, and it
 * reuses their selector so a new decoration is covered everywhere at once.
 */
/**
 * Remove editor-only chrome from clipboard data that Slate has already filled
 * in. Exported so it can be tested without standing up an editor.
 */
export function stripDecorationsFromClipboard(data: DataTransfer): void {
  const html = data.getData("text/html");
  if (!html) return;

  const doc = new DOMParser().parseFromString(html, "text/html");
  const decorations = Array.from(
    doc.querySelectorAll<HTMLElement>(EDITOR_DECORATION_SELECTOR),
  );
  if (decorations.length === 0) return;

  // text/plain is rebuilt by removing each decoration's own text rather than
  // re-deriving it from the cleaned DOM: Slate's getPlainText knows about block
  // boundaries and soft breaks, and a naive textContent would flatten them.
  let plain = data.getData("text/plain");
  for (const decoration of decorations) {
    const text = decoration.textContent ?? "";
    if (text !== "") plain = plain.replace(text, "");
  }

  decorations.forEach((decoration) => decoration.remove());

  data.setData("text/html", doc.body.innerHTML);
  data.setData("text/plain", plain);
}

type FragmentNode = { type?: string; text?: string; children?: FragmentNode[] };

const SLATE_FRAGMENT = "application/x-slate-fragment";

/**
 * Copy the text, not the wrapper it sat in.
 *
 * Slate's fragment carries every ancestor from the root, so a line copied from
 * inside a quote pasted back as a whole new quote, border and all, and a line
 * from a signature as a second signature block. A signature's lines are plain
 * text once copied, and a copy from inside one quote is that quote's text. A
 * selection spanning a quote and the text around it keeps the quote.
 */
export function unwrapCopiedFragment(fragment: FragmentNode[]): FragmentNode[] {
  const blocksOf = (node: FragmentNode) =>
    node.children?.length && node.children.every((child) => "children" in child)
      ? node.children
      : null;
  let nodes = fragment.flatMap(
    (node) => (node.type === "signature" && blocksOf(node)) || [node],
  );
  while (nodes.length === 1 && nodes[0]!.type === "blockquote") {
    const inner = blocksOf(nodes[0]!);
    if (!inner) break;
    nodes = inner;
  }
  return nodes;
}

/** Rewrite Slate's own clipboard copy of the selection, which paste reads first. */
export function unwrapClipboardFragment(data: DataTransfer): void {
  const encoded = data.getData(SLATE_FRAGMENT);
  if (!encoded) return;
  let fragment: unknown;
  try {
    fragment = JSON.parse(decodeURIComponent(window.atob(encoded)));
  } catch {
    return;
  }
  if (!Array.isArray(fragment)) return;
  data.setData(
    SLATE_FRAGMENT,
    window.btoa(encodeURIComponent(JSON.stringify(unwrapCopiedFragment(fragment)))),
  );
}

export const StripDecorationsOnCopyPlugin = createSlatePlugin({
  key: "pmStripDecorationsOnCopy",
}).overrideEditor(({ tf: { setFragmentData } }) => ({
  transforms: {
    setFragmentData(data: DataTransfer, originEvent?: "copy" | "cut" | "drag") {
      setFragmentData(data, originEvent);
      stripDecorationsFromClipboard(data);
      unwrapClipboardFragment(data);
    },
  },
}));
