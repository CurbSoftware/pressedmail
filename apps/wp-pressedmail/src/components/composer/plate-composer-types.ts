import type { Value } from '@kit/plate';
import type {
  PlateEmailEditorAdapterProps,
  PlateEmailEditorRef,
} from '@kit/plate/email-editor';
import type { ComposerSignaturePlacement } from '@/hooks/useUserPreferences';
import type { Signature } from '@/types/signatures';

export type PressedMailComposerValue = Value;

/**
 * Commands the composer owns because they need the document model rather than
 * the HTML string. The shared editor ref handles text, images and pasted HTML;
 * this is the part that knows the email signature contract.
 *
 * Optional because the ref crosses a shared adapter boundary whose callback
 * types speak `PlateEmailEditorRef`, and because the authoring surfaces publish
 * a hand-built ref that has no signature command.
 */
export interface ComposerSignatureCommand {
  /**
   * Seat a signature block, replacing the author's existing one. `placement`
   * decides whether it goes in front of the quote anchor or at the end of the
   * message. The document is edited in place: no other node is re-parsed, so
   * the formatting on the blocks around it survives.
   *
   * `placement` is required, not defaulted, so a caller cannot silently get a
   * different rule from the one the string paths apply.
   */
  insertSignatureBlock?: (
    signature: Pick<Signature, 'content' | 'content_type'>,
    placement: ComposerSignaturePlacement,
  ) => void;
  /** Remove the author's signature block, if the document has one. */
  removeSignatureBlock?: () => void;
}

export type EmailEditorRef = PlateEmailEditorRef & ComposerSignatureCommand;

export interface PressedMailPlateComposerProps
  extends PlateEmailEditorAdapterProps<PressedMailComposerValue> {}
