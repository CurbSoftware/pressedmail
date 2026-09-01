import type { ImapFolder, SystemFolderType } from "@/services/interfaces";

export const MAIL_WORKFLOW_SYSTEM_FOLDER_ORDER: Partial<
  Record<SystemFolderType, number>
> = {
  inbox: 0,
  sent: 30,
  drafts: 40,
  archive: 50,
  spam: 70,
  junk: 70,
  trash: 80,
  snoozed: 100,
  outbox: 110,
  templates: 120,
};

const CUSTOM_FOLDER_ORDER = 1000;

function normalizeSystemType(
  value: string | undefined | null,
): SystemFolderType | undefined {
  const normalized = (value ?? "").toLowerCase().trim();
  if (!normalized) return undefined;
  if (normalized === "junk") return "spam";

  if (normalized in MAIL_WORKFLOW_SYSTEM_FOLDER_ORDER) {
    return normalized as SystemFolderType;
  }

  return undefined;
}

function normalizePath(value: string | undefined | null): string {
  return (value ?? "")
    .toLowerCase()
    .trim()
    .replace(/\/+$/, "")
    .replace(/^\/+/, "");
}

function folderSystemType(folder: ImapFolder): SystemFolderType | undefined {
  return (
    normalizeSystemType(folder.systemType) ??
    normalizeSystemType(folder.type) ??
    normalizeSystemType((folder as ImapFolder & { role?: string }).role)
  );
}

function folderOrder(folder: ImapFolder): number {
  const systemType = folderSystemType(folder);
  return systemType !== undefined
    ? (MAIL_WORKFLOW_SYSTEM_FOLDER_ORDER[systemType] ?? CUSTOM_FOLDER_ORDER)
    : CUSTOM_FOLDER_ORDER;
}

function folderIdentity(folder: ImapFolder): string {
  return (
    normalizePath(folder.path) ||
    normalizePath(folder.imapPath) ||
    normalizePath(folder.imap_path) ||
    normalizePath(folder.name)
  );
}

export function sortMailFoldersByWorkflow(folders: ImapFolder[]): ImapFolder[] {
  const originalIndex = new Map<string, number>();
  let nextIndex = 0;
  const recordOriginalOrder = (folderList: ImapFolder[]) => {
    for (const folder of folderList) {
      const identity = folderIdentity(folder);
      if (identity && !originalIndex.has(identity)) {
        originalIndex.set(identity, nextIndex);
        nextIndex++;
      }
      if (folder.children) {
        recordOriginalOrder(folder.children);
      }
    }
  };
  recordOriginalOrder(folders);

  const sortSiblings = (siblings: ImapFolder[]): ImapFolder[] => {
    return siblings
      .map((folder) => ({
        ...folder,
        children: folder.children ? sortSiblings(folder.children) : undefined,
      }))
      .sort((left, right) => {
        const orderDelta = folderOrder(left) - folderOrder(right);
        if (orderDelta !== 0) return orderDelta;

        const leftIndex = originalIndex.get(folderIdentity(left)) ?? 0;
        const rightIndex = originalIndex.get(folderIdentity(right)) ?? 0;
        return leftIndex - rightIndex;
      });
  };

  return sortSiblings(folders);
}
