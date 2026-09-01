/**
 * Session-level cache tracking which emails have had "Show images" clicked.
 * Persists in memory for the browser session, survives message switches
 * but clears on page reload.
 */
const shownImagesSet = new Set<string>();

interface ImagesShownIdentity {
  accountId?: string | number | null;
  accountEmail?: string | null;
  folder?: string | null;
  folderLabel?: string | null;
  consolidatedUid?: string | number | null;
  uid?: string | number | null;
  messageId?: string | null;
  id?: string | number | null;
  msg_no?: string | number | null;
}

function identityPart(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

/** Build the per-message key used for manual remote-image reveals. */
export function getImagesShownCacheKey(
  message: ImagesShownIdentity | null | undefined,
): string {
  if (!message) return "";

  const account = identityPart(message.accountId ?? message.accountEmail ?? "");
  const folder = identityPart(message.folder ?? message.folderLabel ?? "");
  const messageId = identityPart(
    message.consolidatedUid ??
      message.uid ??
      message.messageId ??
      message.id ??
      message.msg_no ??
      "",
  );

  if (!messageId) return "";

  return `account:${account}|folder:${folder}|message:${messageId}`;
}

/** Mark a message as having images shown. */
export function markImagesShown(msgId: string): void {
  if (msgId) {
    shownImagesSet.add(msgId);
  }
}

/** Check if a message has had images shown previously. */
export function hasImagesShown(msgId: string): boolean {
  return shownImagesSet.has(msgId);
}
