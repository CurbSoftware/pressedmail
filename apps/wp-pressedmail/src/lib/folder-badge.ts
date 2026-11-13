import { _n, sprintf } from "@wordpress/i18n";

import { getCalendarLocale } from "@/components/calendar/calendar-intl";
import type { FolderCountMode } from "@/hooks/useUserPreferences";
import type { SystemFolderType } from "@/services/interfaces";

/**
 * The number beside a folder, or undefined when there is nothing to show.
 *
 * Unread mode: unread for every folder, the total for Drafts.
 * Total mode: every message in the folder, and only when the server marked
 * the total confirmed (`counts_known: true`). Anything else, a list cached
 * before the mark existed included, shows nothing, so a wrong number never
 * appears. Drafts keeps its total in both modes, as it always has.
 * Zero shows nothing in either mode.
 */
export function folderBadgeCount(
  folder: {
    systemType?: SystemFolderType;
    count?: number | null;
    unseen?: number | null;
    counts_known?: boolean;
  },
  mode: FolderCountMode = "unread",
): number | undefined {
  let value: number | null | undefined;
  if (folder.systemType === "drafts") {
    value = folder.count;
  } else if (mode === "total") {
    value = folder.counts_known === true ? folder.count : undefined;
  } else {
    value = folder.unseen;
  }
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

/** The mailbox slots a provider can keep below the top level. */
const NESTABLE_SLOTS = new Set<SystemFolderType>([
  "sent",
  "drafts",
  "archive",
  "spam",
  "junk",
  "trash",
]);

/**
 * The folder behind a mailbox slot, wherever the provider keeps it. Gmail holds
 * Sent, Drafts, Spam and Trash under [Gmail], so a sidebar that reads only the
 * top level finds none of them and their rows carry no number. Only the slots
 * that are real folders are looked up: Important and Starred are counted views,
 * not the provider's folders of the same name.
 */
export function findSystemFolderInTree<
  T extends { systemType?: SystemFolderType; children?: T[] },
>(folders: readonly T[], type: SystemFolderType): T | undefined {
  if (!NESTABLE_SLOTS.has(type)) return undefined;
  const wanted = type === "spam" || type === "junk" ? ["spam", "junk"] : [type];
  const stack = [...folders];
  while (stack.length > 0) {
    const folder = stack.shift() as T;
    if (folder.systemType && wanted.includes(folder.systemType)) return folder;
    if (folder.children?.length) stack.push(...folder.children);
  }
  return undefined;
}

/** How a total is drawn, so it never reads as an unread count. */
export const FOLDER_TOTAL_CLASS =
  "text-xs font-normal tabular-nums text-muted-foreground";

/** A total in the reader's own short form: 950, 1.2K, 34K. */
export function formatFolderTotal(value: number): string {
  return new Intl.NumberFormat(getCalendarLocale(), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** The number as a sidebar row shows it: plain for unread, short for a total. */
export function formatFolderCount(
  value: number,
  mode: FolderCountMode,
): string {
  return mode === "total" ? formatFolderTotal(value) : String(value);
}

/**
 * What a screen reader hears for a folder row: "Inbox, 12 unread messages" or
 * "Inbox, 1,204 messages". The short form on screen ("1.2K") is not a number
 * anyone should have read out.
 */
export function folderCountLabel(
  name: string,
  value: number | undefined,
  mode: FolderCountMode,
): string {
  if (value === undefined || value <= 0) return name;
  if (mode === "total") {
    return sprintf(
      /* translators: 1: folder name, 2: number of messages in the folder, already formatted. */
      _n("%1$s, %2$s message", "%1$s, %2$s messages", value, "pressedmail"),
      name,
      new Intl.NumberFormat(getCalendarLocale()).format(value),
    );
  }
  return sprintf(
    /* translators: 1: folder name, 2: number of unread messages. */
    _n(
      "%1$s, %2$d unread message",
      "%1$s, %2$d unread messages",
      value,
      "pressedmail",
    ),
    name,
    value,
  );
}
