import type { ImapFolder } from "@/services/interfaces";
import type { FilterRuleFolderTarget } from "@/types/filter-rules";
import { apiFetch } from "@/lib/api-client";
import { messagesFoldersRouteApi } from "@/context/Strings";

export interface RuleFolderOption {
  accountId: number;
  folderId: number;
  path: string;
  label: string;
}

export function folderPathsEqual(
  left: string,
  right: string,
  delimiter?: string | null,
  delimiterState: "value" | "nil" | "unknown" = "unknown",
): boolean {
  if (left === right) return true;
  if (
    left.length === 5 &&
    right.length === 5 &&
    left.toUpperCase() === "INBOX" &&
    right.toUpperCase() === "INBOX"
  ) {
    return true;
  }
  if (delimiterState !== "value" || !delimiter) return false;

  const canonical = (path: string): string => {
    if (path.length === 5 && path.toUpperCase() === "INBOX") return "INBOX";
    if (
      path.length >= 5 + delimiter.length &&
      path.slice(0, 5).toUpperCase() === "INBOX" &&
      path.slice(5, 5 + delimiter.length) === delimiter
    ) {
      return `INBOX${path.slice(5)}`;
    }
    return path;
  };

  return canonical(left) === canonical(right);
}

export function isResolvedFilterRuleFolderTarget(
  value: unknown,
): value is FilterRuleFolderTarget & { folderId: number } {
  if (!value || typeof value !== "object") return false;
  const target = value as Partial<FilterRuleFolderTarget>;
  return (
    target.status === "resolved" &&
    typeof target.accountId === "number" &&
    target.accountId > 0 &&
    typeof target.folderId === "number" &&
    target.folderId > 0 &&
    typeof target.lastKnownPath === "string"
  );
}

export function buildRuleFolderOptions(
  folders: ImapFolder[],
  selectedAccountId: number,
  accountLabels: ReadonlyMap<number, string>,
): RuleFolderOption[] {
  const hasNestedNodes = folders.some(
    (folder) => Array.isArray(folder.children) && folder.children.length > 0,
  );
  const tree = hasNestedNodes ? folders : buildTreeFromFlat(folders);
  const options: RuleFolderOption[] = [];
  const visit = (nodes: ImapFolder[], parents: string[]) => {
    for (const node of nodes) {
      const crumbs = [...parents, node.name];
      if (
        node.selectable !== false &&
        typeof node.id === "number" &&
        typeof node.accountId === "number" &&
        node.accountId === selectedAccountId
      ) {
        options.push({
          accountId: node.accountId,
          folderId: node.id,
          path: node.path,
          label: [accountLabels.get(node.accountId) ?? String(node.accountId), ...crumbs]
            .filter(Boolean)
            .join(" / "),
        });
      }
      visit(node.children ?? [], crumbs);
    }
  };
  visit(tree, []);
  return options;
}

function buildTreeFromFlat(folders: ImapFolder[]): ImapFolder[] {
  const nodes = new Map<number, ImapFolder>();
  for (const folder of folders) {
    if (typeof folder.id === "number" && folder.id > 0) {
      nodes.set(folder.id, { ...folder, children: [] });
    }
  }
  const roots: ImapFolder[] = [];
  for (const folder of folders) {
    if (typeof folder.id !== "number" || folder.id <= 0) continue;
    const node = nodes.get(folder.id);
    if (!node) continue;
    const parentId = folder.parentId ?? folder.parent_id ?? null;
    const parent = typeof parentId === "number" ? nodes.get(parentId) : undefined;
    if (parent && parent.accountId === node.accountId && parent.id !== node.id) {
      parent.children?.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (items: ImapFolder[]): ImapFolder[] =>
    items
      .sort((left, right) =>
        left.path === right.path
          ? Number(left.id ?? 0) - Number(right.id ?? 0)
          : left.path.localeCompare(right.path),
      )
      .map((item) => ({
        ...item,
        children: sortNodes(item.children ?? []),
      }));
  return sortNodes(roots);
}

export function optionToFilterRuleFolderTarget(
  option: RuleFolderOption,
): FilterRuleFolderTarget {
  return {
    accountId: option.accountId,
    folderId: option.folderId,
    lastKnownPath: option.path,
    status: "resolved",
  };
}

/** Load Core's authoritative hierarchy for Rules settings (which is outside InboxProvider). */
export async function loadRuleFolderTrees(
  accountIds: number[],
): Promise<ImapFolder[]> {
  const results = await Promise.allSettled(
    [...new Set(accountIds.filter((id) => Number.isInteger(id) && id > 0))].map(
      async (accountId) => {
        const response = await apiFetch(`${messagesFoldersRouteApi}${accountId}`, {
          credentials: "include",
        });
        if (!response.ok) return [];
        const data = (await response.json()) as {
          folder_tree?: ImapFolder[];
          folders?: ImapFolder[];
        };
        const folders = Array.isArray(data.folder_tree)
          ? data.folder_tree
          : Array.isArray(data.folders)
            ? data.folders
            : [];
        const annotate = (nodes: ImapFolder[]): ImapFolder[] =>
          nodes.map((node) => ({
            ...node,
            accountId: node.accountId ?? accountId,
            children: annotate(node.children ?? []),
          }));
        return annotate(folders);
      },
    ),
  );
  return results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
}
