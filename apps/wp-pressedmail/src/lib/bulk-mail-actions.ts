import { getMessageIdentityKey } from "@/lib/message-identity";
import type { ImapFolder } from "@/services/interfaces";
import type { EmailMessage, EmailMessageTag } from "@/types";
import type { Tag } from "@/types/tags";

const EXCLUDED_MOVE_ROLES = new Set([
  "archive",
  "drafts",
  "junk",
  "sent",
  "scheduled",
  "spam",
  "trash",
]);

function normalizeFolderToken(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, " ");
}

function pathIncludesSegment(path: string, segment: string): boolean {
  return normalizeFolderToken(path)
    .split(/[\\/]/)
    .some((part) => part === segment);
}

export function getFolderRole(folder: ImapFolder): string | null {
  const explicit = normalizeFolderToken(folder.systemType ?? folder.type);
  if (explicit) {
    return explicit === "junk" ? "spam" : explicit;
  }

  const name = normalizeFolderToken(folder.name);
  const path = normalizeFolderToken(folder.path);

  if (name === "inbox" || path === "inbox") return "inbox";
  if (name.includes("draft")) return "drafts";
  if (name.includes("sent")) return "sent";
  if (name.includes("scheduled")) return "scheduled";
  if (name.includes("trash") || pathIncludesSegment(path, "trash")) {
    return "trash";
  }
  if (name.includes("spam") || name.includes("junk")) return "spam";
  if (pathIncludesSegment(path, "spam") || pathIncludesSegment(path, "junk")) {
    return "spam";
  }
  if (name.includes("archive") || pathIncludesSegment(path, "archive")) {
    return "archive";
  }

  return null;
}

export function getBulkMoveTargetFolders(
  folders: ImapFolder[],
  selectedFolder: string | null | undefined,
): ImapFolder[] {
  const selected = normalizeFolderToken(selectedFolder);

  return folders.filter((folder) => {
    if (folder.selectable === false) return false;
    if (selected && normalizeFolderToken(folder.path) === selected)
      return false;

    const role = getFolderRole(folder);
    if (!role) return true;

    return !EXCLUDED_MOVE_ROLES.has(role);
  });
}

const SWEEP_EXCLUDED_MOVE_ROLES = new Set(["drafts", "sent", "scheduled"]);

/**
 * Destination folders for the Email Sweep "move to folder" dropdown. Unlike
 * {@link getBulkMoveTargetFolders}, this INCLUDES Junk/Spam, Trash, and Archive,
 * because Sweep is explicitly a "file these emails away" action. The user asked
 * to be able to move to folders including Junk and Trash. Only special-purpose
 * compose folders (Drafts/Sent/Scheduled) are excluded.
 */
export function getSweepMoveTargetFolders(folders: ImapFolder[]): ImapFolder[] {
  return folders.filter((folder) => {
    if (folder.selectable === false) return false;
    const role = getFolderRole(folder);
    if (!role) return true;
    return !SWEEP_EXCLUDED_MOVE_ROLES.has(role);
  });
}

export function findArchiveFolder(folders: ImapFolder[]): ImapFolder | null {
  const selectableFolders = folders.filter(
    (folder) => folder.selectable !== false,
  );
  return (
    selectableFolders.find((folder) => getFolderRole(folder) === "archive") ??
    null
  );
}

/**
 * Role-alias token the server (MutationFolderResolver) maps to the provider's
 * real archive target, including Gmail's All Mail via the `All` flag, since
 * Gmail has no Archive folder and archiving means dropping `\Inbox`. Use it as a
 * move target when the client folder list has not surfaced an Archive folder
 * (e.g. the provider's real All Mail folder is hidden), so the Archive action
 * never dead-ends with "No archive folder available".
 */
export const ARCHIVE_MOVE_FALLBACK = "Archive";

/**
 * Resolve the move target for an "Archive" action: the known archive folder
 * path when one is in the list, otherwise the server-resolvable role token.
 */
export function resolveArchiveMoveTarget(folders: ImapFolder[]): string {
  return findArchiveFolder(folders)?.path ?? ARCHIVE_MOVE_FALLBACK;
}

export function findJunkFolder(folders: ImapFolder[]): ImapFolder | null {
  return (
    folders.find(
      (folder) =>
        folder.selectable !== false && getFolderRole(folder) === "spam",
    ) ?? null
  );
}

/**
 * Role-alias token the server (MutationFolderResolver) maps to the provider's
 * real junk/spam folder, Gmail "[Gmail]/Spam", Outlook "Junk Email", etc., and
 * which JunkFolderEnsurer auto-creates on bare/custom IMAP. Use it as a move
 * target when the client folder list has not surfaced a junk folder, so
 * "Mark as spam" never dead-ends with "No junk/spam folder available".
 */
export const JUNK_MOVE_FALLBACK = "Junk";

/**
 * Resolve the move target for a "Mark as spam" action: the known junk folder
 * path when one is in the list, otherwise the server-resolvable role token.
 */
export function resolveJunkMoveTarget(folders: ImapFolder[]): string {
  return findJunkFolder(folders)?.path ?? JUNK_MOVE_FALLBACK;
}

export function findTrashFolder(folders: ImapFolder[]): ImapFolder | null {
  return (
    folders.find(
      (folder) =>
        folder.selectable !== false && getFolderRole(folder) === "trash",
    ) ?? null
  );
}

/**
 * Role-alias token the server maps to the provider's real trash folder. Use it
 * when the client folder list has not surfaced Trash, so Delete remains a move
 * to trash rather than an expunge/delete operation.
 */
export const TRASH_MOVE_FALLBACK = "Trash";

/**
 * Resolve the move target for a "Delete" action: the known trash folder path
 * when one is in the list, otherwise the server-resolvable role token.
 */
export function resolveTrashMoveTarget(folders: ImapFolder[]): string {
  return findTrashFolder(folders)?.path ?? TRASH_MOVE_FALLBACK;
}

export function toMessageTag(tag: Tag): EmailMessageTag {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    icon: tag.icon ?? null,
  };
}

export function getMessageTagList(message: EmailMessage): EmailMessageTag[] {
  return Array.isArray(message.tags) ? message.tags : [];
}

export function hasMessageTag(message: EmailMessage, tagId: number): boolean {
  return getMessageTagList(message).some((tag) => Number(tag.id) === tagId);
}

export function projectMessageTags(
  message: EmailMessage,
  tag: Tag,
  shouldSelect: boolean,
): EmailMessageTag[] {
  const messageTag = toMessageTag(tag);
  const existing = getMessageTagList(message).filter(
    (item) => Number(item.id) !== tag.id,
  );

  return shouldSelect ? [...existing, messageTag] : existing;
}

export function buildMessageTagUpdate(
  message: EmailMessage,
  tag: Tag,
  shouldSelect: boolean,
): { localId: string; tags: EmailMessageTag[] } {
  return {
    localId: getMessageIdentityKey(message),
    tags: projectMessageTags(message, tag, shouldSelect),
  };
}
