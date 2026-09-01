/**
 * Mailbox read-source selection used by the live retrieval engine.
 *
 * `getMailboxSourceRequestParams` opts mailbox reads into the mirror-backed
 * (DB) path when the `__USE_DB_MAILBOX__` build flag is enabled; otherwise it
 * returns no extra params and the legacy IMAP-backed responses are used.
 *
 * This is a standalone build-time helper consumed by the InboxService /
 * FolderService / MessageService read paths. It has no runtime dependencies.
 */

export const USE_DB_MAILBOX = __USE_DB_MAILBOX__;
export const CANONICAL_MAILBOX_IDENTIFIER = "uid" as const;

export type CanonicalMailboxScalarId = string | number;
export type CanonicalMailboxSource = "imap" | "db";

/**
 * Request parameters used to opt mailbox reads into the mirror-backed path.
 */
export function getMailboxSourceRequestParams(): {
  mailbox_source?: CanonicalMailboxSource;
} {
  return USE_DB_MAILBOX ? { mailbox_source: "db" } : {};
}
