import { __ } from "@wordpress/i18n";

import type { FolderCountMode } from "@/hooks/useUserPreferences";
import { folderBadgeCount } from "@/lib/folder-badge";
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
  // Snoozed and Scheduled are Pro views.
  if (!__IS_FREE__ && type === "snoozed") return __("Snoozed", "pressedmail");
  if (!__IS_FREE__ && type === "scheduled") {
    return __("Scheduled", "pressedmail");
  }
  switch (type) {
    case "inbox":
      return __("Inbox", "pressedmail");
    case "starred":
    case "flagged":
      return __("Starred", "pressedmail");
    case "important":
      return __("Important", "pressedmail");
    case "sent":
      return __("Sent", "pressedmail");
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
 * Badge number for a mailbox row: the same rule as lib/folder-badge, which
 * every desktop sidebar uses, so the phone and the desktop never show two
 * different numbers for one mailbox. Zero when there is nothing to show.
 */
export function mailboxBadgeCount(
  folder: Parameters<typeof folderBadgeCount>[0],
  mode: FolderCountMode = "unread",
): number {
  return folderBadgeCount(folder, mode) ?? 0;
}
