import type { ImapFolder } from "@/services/interfaces";

/** Numeric badge for a folder: unread for all, except Drafts which shows total.
 *  undefined when nothing to show so the shared zero-hide keeps the badge off. */
export function folderBadgeCount(
  folder: Pick<ImapFolder, "systemType" | "count" | "unseen">,
): number | undefined {
  const value =
    folder.systemType === "drafts" ? (folder.count ?? 0) : (folder.unseen ?? 0);
  return value > 0 ? value : undefined;
}
