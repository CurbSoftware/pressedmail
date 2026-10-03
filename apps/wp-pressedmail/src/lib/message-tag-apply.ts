import { __ } from "@wordpress/i18n";

export interface MessageTagApplySteps {
  /** One write per tag added or removed, in order. */
  writes: Array<() => Promise<void>>;
  /** False once the message, mailbox or user changed underneath. */
  isCurrent: () => boolean;
  /** Read the message's tags back from the server. */
  reload: () => Promise<void>;
  /** A write failed: drop cached tags and mark the draft's base unknown. */
  onWriteFailed: () => void;
  /** The read-back failed: drop cached tags and redraw the list. */
  onReloadFailed: () => void;
}

/**
 * Apply one email's tag change, then read its tags back.
 *
 * The write and the read-back fail differently. A failed write rejects with
 * the server's own message so the popover can show it and keep the draft for
 * a retry. A read-back that fails after every write landed is not a failed
 * save: the change is on the server, so it resolves and the popover closes,
 * with the list redrawn from the server instead.
 */
export async function applyMessageTagSteps({
  writes,
  isCurrent,
  reload,
  onWriteFailed,
  onReloadFailed,
}: MessageTagApplySteps): Promise<void> {
  let writeError: unknown = null;
  for (const write of writes) {
    if (!isCurrent()) return;
    try {
      await write();
    } catch (error) {
      writeError = error;
      break;
    }
  }
  if (!isCurrent()) return;
  if (writeError) onWriteFailed();

  try {
    // After a failure this learns which writes landed, so the draft's base
    // is right for a retry.
    await reload();
  } catch {
    if (!isCurrent()) return;
    onReloadFailed();
    if (!writeError) return;
    throw new Error(
      __(
        "Couldn't check which tags saved. Close this and open it again.",
        "pressedmail",
      ),
    );
  }
  if (!isCurrent() || !writeError) return;
  console.error("Failed to update message tags:", writeError);
  throw writeError instanceof Error && writeError.message
    ? writeError
    : new Error(
        __("Couldn't save. Your choices are kept. Try again.", "pressedmail"),
      );
}
