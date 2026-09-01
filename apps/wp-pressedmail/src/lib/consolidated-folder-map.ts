import type { ImapFolder } from "@/services/interfaces";

export type ConsolidatedFolderMap = Record<string, string>;

function normalizeFolderPath(path: string): string {
  return path.toLowerCase().trim().replace(/\/+$/, "").replace(/^\/+/, "");
}

function normalizeFolderMap(
  folderMap: Record<string | number, string> | undefined,
): ConsolidatedFolderMap | undefined {
  if (!folderMap) {
    return undefined;
  }

  const normalized: ConsolidatedFolderMap = {};
  for (const [accountId, path] of Object.entries(folderMap)) {
    const numericId = Number(accountId);
    const folderPath = String(path ?? "").trim();
    if (!Number.isInteger(numericId) || numericId <= 0 || !folderPath) {
      continue;
    }
    normalized[String(numericId)] = folderPath;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function buildConsolidatedFolderMap(
  folder: ImapFolder | null | undefined,
): ConsolidatedFolderMap | undefined {
  if (!folder?.sourceFolders || folder.sourceFolders.length === 0) {
    return undefined;
  }

  return normalizeFolderMap(
    Object.fromEntries(
      folder.sourceFolders.map((source) => [
        String(source.accountId),
        source.path,
      ]),
    ),
  );
}

export function getConsolidatedFolderMapForPath(
  folders: ImapFolder[],
  folderPath: string | null | undefined,
): ConsolidatedFolderMap | undefined {
  if (!folderPath) {
    return undefined;
  }

  const normalizedTarget = normalizeFolderPath(folderPath);
  const folder = folders.find((candidate) => {
    const paths = [
      candidate.path,
      candidate.imapPath,
      candidate.imap_path,
      candidate.name,
    ].filter((value): value is string => Boolean(value));

    return paths.some((path) => normalizeFolderPath(path) === normalizedTarget);
  });

  return buildConsolidatedFolderMap(folder);
}

export function serializeConsolidatedFolderMap(
  folderMap: Record<string | number, string> | undefined,
): string | undefined {
  const normalized = normalizeFolderMap(folderMap);
  if (!normalized) {
    return undefined;
  }

  const sorted = Object.fromEntries(
    Object.entries(normalized).sort(
      ([left], [right]) => Number(left) - Number(right),
    ),
  );

  return JSON.stringify(sorted);
}
