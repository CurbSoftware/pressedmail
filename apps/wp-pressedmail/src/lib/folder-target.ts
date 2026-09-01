import type {
  DestinationMutationTarget,
} from "@/lib/folder-destination";
import type { FolderTarget, ImapFolder } from "@/services/interfaces";

export type MutationTarget = string | FolderTarget | DestinationMutationTarget;

export function folderMutationTarget(folder: ImapFolder): MutationTarget {
  // Consolidated union entries carry an account-agnostic destination the
  // server resolves (and creates when missing) per account.
  if (folder.consolidatedDestination) {
    return {
      kind: "destination",
      destination: folder.consolidatedDestination,
      path: folder.path,
    };
  }

  return typeof folder.accountId === "number" && typeof folder.id === "number"
    ? { accountId: folder.accountId, folderId: folder.id, path: folder.path }
    : folder.path;
}

export function folderTargetKey(folder: ImapFolder): string {
  if (folder.consolidatedDestination) {
    return `destination:${folder.path}`;
  }
  return typeof folder.accountId === "number" && typeof folder.id === "number"
    ? `${folder.accountId}:${folder.id}`
    : `legacy:${folder.path}`;
}
