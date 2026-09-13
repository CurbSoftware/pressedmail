import { __ } from "@wordpress/i18n";

import type { ImapFolder, SystemFolderType } from "@/services/interfaces";

/**
 * Translated label for a system mailbox slot.
 *
 * Mirrors the desktop sidebar's getSystemLabel (FolderPane). The phone screens
 * used to render `folder.name || slot.label`, so a Gmail account showed the raw
 * provider path "INBOX" sitting next to a translated "Important", and no locale
 * ever translated it.
 */
export function getMailboxSlotLabel(type: SystemFolderType | "junk"): string {
  switch (type) {
    case "inbox":
      return __("Inbox", "pressedmail");
    case "starred":
    case "flagged":
      return __("Starred", "pressedmail");
    case "important":
      return __("Important", "pressedmail");
    case "snoozed":
      return __("Snoozed", "pressedmail");
    case "sent":
      return __("Sent", "pressedmail");
    case "scheduled":
      return __("Scheduled", "pressedmail");
    case "outbox":
      return __("Outbox", "pressedmail");
    case "drafts":
      return __("Drafts", "pressedmail");
    case "archive":
      return __("Archive", "pressedmail");
    case "spam":
    case "junk":
      return __("Junk", "pressedmail");
    case "trash":
      return __("Trash", "pressedmail");
    case "templates":
      return __("Templates", "pressedmail");
    default:
      return type;
  }
}

/**
 * Depth-first flatten of a provider folder tree.
 *
 * The folder service stores a nested tree and annotates `systemType` at every
 * level, but useFolderOperations only normalizes the top level. On Gmail the
 * system folders are children of `[Gmail]`, so matching slots against the
 * top-level list alone found no Sent, Drafts, Junk or Trash and the phone
 * simply dropped them: those mailboxes were unreachable on a phone for every
 * Gmail account.
 */
export function flattenImapFolders(folders: ImapFolder[]): ImapFolder[] {
  const flat: ImapFolder[] = [];
  const visit = (list: ImapFolder[]) => {
    for (const folder of list) {
      flat.push(folder);
      if (folder.children?.length) visit(folder.children);
    }
  };
  visit(folders);
  return flat;
}

/**
 * Badge number for a mailbox row: unread everywhere, total for Drafts.
 *
 * Same rule as lib/folder-badge, which every desktop sidebar uses. The phone
 * preferred `displayCount` (the folder total), so mobile showed "Inbox 46"
 * where the desktop sidebar showed "Inbox 38" for the same mailbox and the two
 * numbers meant different things.
 */
export function mailboxBadgeCount(folder: {
  systemType?: SystemFolderType;
  count?: number;
  unseen?: number;
}): number {
  const value =
    folder.systemType === "drafts" ? (folder.count ?? 0) : (folder.unseen ?? 0);
  return value > 0 ? value : 0;
}
