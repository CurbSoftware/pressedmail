/**
 * A reference to one MIME part of a stored message.
 *
 * Lives here rather than beside the ICS import client because the reading pane
 * in both editions types its attachment callbacks with it, and the ICS client
 * itself is Pro-only. A shared type is what keeps `mail-display.tsx` free of an
 * import from a module the Free build never compiles.
 */

interface MessageAttachmentBase {
  accountId: number;
  folder: string;
  /** Exact dotted MIME part identifier, never a positional array index. */
  part: string;
}

export type MessageAttachmentRef = MessageAttachmentBase &
  (
    | { uid: string | number; msgNo?: never }
    | { uid?: never; msgNo: string | number }
  );
