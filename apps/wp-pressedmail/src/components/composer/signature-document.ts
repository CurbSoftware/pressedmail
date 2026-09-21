'use client';

/**
 * Document-model placement for the author's signature block.
 *
 * A signature used to be placed by serialising the whole body to HTML, splicing
 * the block in as a string and deserialising the result back into the editor.
 * That round trip rewrote every block in the message. Text colour and font size
 * only reach the HTML as CSS class names that nothing reads back, so they were
 * gone; and because the splice cut at the first `<hr` in the serialized markup,
 * it landed inside the `<hr>` wrapper element and left the signature nested
 * inside the separator rather than beside it.
 *
 * This inserts at a path instead: the value is read to find the quote anchor,
 * the block goes in front of it, and nothing else in the document is re-parsed.
 */

import type { Descendant } from '@kit/plate';
import type { PlateEditor } from '@kit/plate/react';

import { parseComposerHtmlInert } from '@/lib/composer/composer-html-inert';
import {
  SIGNATURE_QUOTE_ANCHORS,
  signatureInsertMarkup,
} from '@/services/signature.service';
import type { ComposerSignaturePlacement } from '@/hooks/useUserPreferences';
import type { Signature } from '@/types/signatures';

/** The node type the SignatureBlockPlugin HTML parser emits. */
const SIGNATURE_NODE_TYPE = 'signature';

const QUOTE_ANCHOR_NODE_TYPES = SIGNATURE_QUOTE_ANCHORS.flatMap(
  (anchor) => anchor.nodeTypes ?? [],
);

function nodeType(node: unknown): string | undefined {
  return (node as { type?: string } | null)?.type;
}

/** Root children only: a signature nested in a blockquote is the quoted
 * sender's, and a signature already quoted is not the author's to replace. */
function isAuthorSignature(node: unknown): boolean {
  return nodeType(node) === SIGNATURE_NODE_TYPE;
}

function isQuoteAnchor(node: unknown): boolean {
  const type = nodeType(node);
  return type !== undefined && QUOTE_ANCHOR_NODE_TYPES.includes(type);
}

/** Index of the quote anchor among the root blocks, or -1 for none. */
function findQuoteAnchor(editor: PlateEditor): number {
  return editor.children.findIndex(isQuoteAnchor);
}

function removeAuthorSignatures(editor: PlateEditor): void {
  // Backwards, so the indices ahead of each removal stay valid.
  for (let index = editor.children.length - 1; index >= 0; index -= 1) {
    if (isAuthorSignature(editor.children[index])) {
      editor.tf.removeNodes({ at: [index] });
    }
  }
}

function deserializeFragment(
  editor: PlateEditor,
  html: string,
): Descendant[] | null {
  try {
    return editor.api.html.deserialize({
      element: parseComposerHtmlInert(html),
    }) as Descendant[];
  } catch {
    // Leaving the document alone beats inserting half a block.
    return null;
  }
}

/**
 * Seat the author's signature block, replacing any block they already have.
 *
 * `placement` does not mirror `applySignature` exactly, deliberately. That rule
 * decides on `replyish` plus a substring search of the whole body, so it will
 * anchor on a quote nested inside a table cell or a list item. This one walks
 * the root blocks only, because seating a signature inside a table would be
 * worse than appending it: a nested quote is not an anchor here, and the block
 * goes to the end of the message instead.
 *
 * `placement` is required rather than defaulted. A default here would silently
 * disagree with the mode-dependent rule the string paths use, and every caller
 * already knows which one it means.
 */
export function insertSignatureBlockInDocument(
  editor: PlateEditor,
  signature: Pick<Signature, 'content' | 'content_type'>,
  placement: ComposerSignaturePlacement,
): void {
  const anchor = findQuoteAnchor(editor);
  const aboveQuote = placement === 'before_quote' && anchor !== -1;

  // Read the markup before removing anything: markup the editor cannot parse
  // must not cost the author the block they already had.
  const fragment = deserializeFragment(
    editor,
    signatureInsertMarkup(signature, aboveQuote),
  );
  if (!fragment || fragment.length === 0) return;

  editor.tf.withoutNormalizing(() => {
    removeAuthorSignatures(editor);
    // `aboveQuote` means the anchor was a root hr or blockquote, and only root
    // signature nodes are removed, so the anchor cannot have gone with them.
    const at = aboveQuote ? findQuoteAnchor(editor) : editor.children.length;
    editor.tf.insertNodes(fragment, { at: [at] });
  });
}

/**
 * Drop the author's signature block, leaving every other node alone.
 *
 * The mount effect used to reach this by rebuilding the whole body as a string
 * and calling setContent, which cost the author their formatting on the blocks
 * around it. Only root-level blocks are removed: one nested in a blockquote is
 * the quoted sender's.
 */
export function removeSignatureBlockInDocument(editor: PlateEditor): void {
  editor.tf.withoutNormalizing(() => {
    removeAuthorSignatures(editor);
  });
}
