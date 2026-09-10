"use client";

import {
  getPrincipalStorageItem,
  setPrincipalStorageItem,
} from "@/lib/principal-storage";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Folder, FolderOpen } from "lucide-react";

import { useDragDropContext } from "@/components/shared/drag-drop";
import { cn } from "@/lib/utils";
import {
  SIDEBAR_NAV_ICON_CLASS,
  SIDEBAR_NAV_ITEM_CLASS,
} from "@/lib/sidebar-navigation-styles";
import type { FolderTarget, ImapFolder } from "@/services/interfaces";

export interface ProviderFolderTarget extends FolderTarget {
  label: string;
  folder: ImapFolder;
}

export interface ProviderFolderParentOption {
  accountId: number;
  folderId: number;
  path: string;
  label: string;
}

interface IndexedNode {
  folder: ImapFolder;
  key: string;
  parentKey: string | null;
  level: number;
  label: string;
}

const EMPTY_EXPANDED_IDS: number[] = [];

function realFolderId(folder: ImapFolder): number | null {
  return typeof folder.id === "number" &&
    Number.isInteger(folder.id) &&
    folder.id !== 0
    ? folder.id
    : null;
}

/** Build hierarchy only from Core IDs. Folder punctuation is never parsed. */
export function buildProviderFolderTree(folders: ImapFolder[]): ImapFolder[] {
  if (folders.some((folder) => (folder.children?.length ?? 0) > 0))
    return folders;

  const counts = new Map<number, number>();
  for (const folder of folders) {
    const id = realFolderId(folder);
    if (id !== null) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const nodes = new Map<number, ImapFolder>();
  for (const folder of folders) {
    const id = realFolderId(folder);
    if (id !== null && counts.get(id) === 1)
      nodes.set(id, { ...folder, children: [] });
  }

  const roots: ImapFolder[] = [];
  for (const folder of folders) {
    const id = realFolderId(folder);
    if (id === null || counts.get(id) !== 1) {
      // Missing IDs remain legacy render-only identities. Duplicate real IDs are
      // surfaced as data errors instead of being replaced by invented IDs.
      roots.push({ ...folder, children: folder.children ?? [] });
      continue;
    }
    const node = nodes.get(id);
    if (!node) continue;
    const parentId = folder.parentId ?? folder.parent_id ?? null;
    const parent =
      typeof parentId === "number" ? nodes.get(parentId) : undefined;
    if (parent && parent.id !== node.id)
      parent.children = [...(parent.children ?? []), node];
    else roots.push(node);
  }
  return roots;
}

export function filterProviderFolderTree(
  folders: ImapFolder[],
  include: (folder: ImapFolder) => boolean,
): ImapFolder[] {
  return buildProviderFolderTree(folders).flatMap((folder) => {
    const children = filterProviderFolderTree(folder.children ?? [], include);
    if (include(folder)) return [{ ...folder, children }];
    return children.length ? [{ ...folder, selectable: false, children }] : [];
  });
}

function indexTree(
  folders: ImapFolder[],
  defaultAccountId: number,
): Map<string, IndexedNode> {
  const idCounts = new Map<string, number>();
  const count = (nodes: ImapFolder[]) =>
    nodes.forEach((folder) => {
      const accountId = folder.accountId ?? defaultAccountId;
      const id = realFolderId(folder);
      if (id !== null) {
        const identity = `${accountId}:${id}`;
        idCounts.set(identity, (idCounts.get(identity) ?? 0) + 1);
      }
      count(folder.children ?? []);
    });
  count(folders);

  const index = new Map<string, IndexedNode>();
  const visit = (
    nodes: ImapFolder[],
    parentKey: string | null,
    level: number,
    ancestors: string[],
  ) =>
    nodes.forEach((folder, position) => {
      const accountId = folder.accountId ?? defaultAccountId;
      const id = realFolderId(folder);
      const identity = id === null ? null : `${accountId}:${id}`;
      const key =
        id === null
          ? `legacy:${accountId}:${folder.path}:${position}`
          : idCounts.get(identity!) === 1
            ? `folder:${identity}`
            : `data-error:${identity}:${folder.path}:${position}`;
      const labels = [...ancestors, folder.name || folder.path];
      index.set(key, {
        folder,
        key,
        parentKey,
        level,
        label: labels.join(" / "),
      });
      visit(folder.children ?? [], key, level + 1, labels);
    });
  visit(buildProviderFolderTree(folders), null, 1, []);
  return index;
}

function findNodeById(
  index: Map<string, IndexedNode>,
  accountId: number,
  folderId: number,
) {
  return Array.from(index.values()).find(
    (node) =>
      (node.folder.accountId ?? accountId) === accountId &&
      realFolderId(node.folder) === folderId,
  );
}

export function getEligibleFolderParents(
  folders: ImapFolder[],
  options: { accountId: number; currentFolderId?: number | null },
): ProviderFolderParentOption[] {
  const index = indexTree(folders, options.accountId);
  const excluded = new Set<number>();
  if (typeof options.currentFolderId === "number") {
    excluded.add(options.currentFolderId);
    const addDescendants = (parentId: number) => {
      for (const node of index.values()) {
        const id = realFolderId(node.folder);
        const nodeParent =
          node.folder.parentId ?? node.folder.parent_id ?? null;
        if (id !== null && nodeParent === parentId && !excluded.has(id)) {
          excluded.add(id);
          addDescendants(id);
        }
      }
    };
    addDescendants(options.currentFolderId);
  }

  return Array.from(index.values()).flatMap((node) => {
    const id = realFolderId(node.folder);
    const accountId = node.folder.accountId ?? options.accountId;
    if (
      id === null ||
      accountId !== options.accountId ||
      excluded.has(id) ||
      node.folder.canHaveChildren !== true
    )
      return [];
    return [
      { accountId, folderId: id, path: node.folder.path, label: node.label },
    ];
  });
}

export function getNearestSelectableFolderAncestor(
  folders: ImapFolder[],
  accountId: number,
  path: string,
): FolderTarget | null {
  let result: FolderTarget | null = null;
  const visit = (nodes: ImapFolder[], ancestors: ImapFolder[]): boolean => {
    for (const folder of nodes) {
      if (folder.path === path) {
        const parent = [...ancestors]
          .reverse()
          .find(
            (candidate) =>
              candidate.selectable !== false &&
              realFolderId(candidate) !== null,
          );
        if (parent) {
          result = {
            accountId: parent.accountId ?? accountId,
            folderId: realFolderId(parent),
            path: parent.path,
          };
        }
        return true;
      }
      if (visit(folder.children ?? [], [...ancestors, folder])) return true;
    }
    return false;
  };
  visit(buildProviderFolderTree(folders), []);
  return result;
}

function expansionKey(accountId: number, folderId: number): string {
  return `${accountId}:${folderId}`;
}

function storageKey(accountId: number): string {
  return `pressedmail:folder-tree:expanded:${accountId}`;
}

function readExpanded(accountId: number, defaults: number[]): Set<string> {
  const defaultKeys = defaults.map((id) => expansionKey(accountId, id));
  if (typeof window === "undefined") return new Set(defaultKeys);
  try {
    const stored = JSON.parse(
      getPrincipalStorageItem("local", storageKey(accountId)) ?? "[]",
    );
    return new Set([
      ...defaultKeys,
      ...(Array.isArray(stored)
        ? stored.filter((v): v is string => typeof v === "string")
        : []),
    ]);
  } catch {
    return new Set(defaultKeys);
  }
}

function StableDropSurface({
  target,
  children,
}: {
  target: ProviderFolderTarget;
  children: React.ReactNode;
}) {
  const dropId = `folder-target:${target.accountId}:${target.folderId}`;
  const { activeDropZone, isDragging } = useDragDropContext();
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { folderTarget: target },
  });
  return (
    <div
      ref={setNodeRef}
      role="none"
      data-folder-drop-account={target.accountId}
      data-folder-drop-id={target.folderId}
      className={cn(
        "rounded-md",
        isDragging &&
          (isOver || activeDropZone === dropId) &&
          "ring-2 ring-primary bg-primary/10",
      )}>
      {children}
    </div>
  );
}

export interface ProviderFolderTreeProps {
  accountId: number;
  folders: ImapFolder[];
  selectedPath?: string | null;
  selectedTarget?: FolderTarget | null;
  onSelect: (target: ProviderFolderTarget) => void;
  defaultExpandedIds?: number[];
  expandFolderId?: number | null;
  compact?: boolean;
  mobile?: boolean;
  className?: string;
  testIdPrefix?: string;
  renderTrailing?: (target: ProviderFolderTarget) => React.ReactNode;
}

export function ProviderFolderTree({
  accountId,
  folders,
  selectedPath,
  selectedTarget,
  onSelect,
  defaultExpandedIds = EMPTY_EXPANDED_IDS,
  expandFolderId,
  compact = false,
  mobile = false,
  className,
  testIdPrefix,
  renderTrailing,
}: ProviderFolderTreeProps) {
  const tree = React.useMemo(() => buildProviderFolderTree(folders), [folders]);
  const index = React.useMemo(
    () => indexTree(tree, accountId),
    [accountId, tree],
  );
  const [expanded, setExpanded] = React.useState(() =>
    readExpanded(accountId, defaultExpandedIds),
  );
  const [focusedKey, setFocusedKey] = React.useState<string | null>(
    () => index.keys().next().value ?? null,
  );
  const refs = React.useRef(new Map<string, HTMLDivElement>());

  const persistExpansion = React.useCallback(
    (next: Set<string>) => {
      setExpanded(next);
      if (typeof window !== "undefined")
        setPrincipalStorageItem(
          "local",
          storageKey(accountId),
          JSON.stringify([...next]),
        );
    },
    [accountId],
  );

  React.useEffect(
    () => setExpanded(readExpanded(accountId, defaultExpandedIds)),
    [accountId, defaultExpandedIds],
  );
  React.useEffect(() => {
    if (typeof expandFolderId !== "number") return;
    const node = findNodeById(index, accountId, expandFolderId);
    if (!node) return;
    const next = new Set(expanded);
    next.add(expansionKey(accountId, expandFolderId));
    persistExpansion(next);
    setFocusedKey(node.key);
    window.setTimeout(() => refs.current.get(node.key)?.focus(), 0);
    // expandFolderId is an explicit completion event; duplicate values need not replay.
  }, [accountId, expandFolderId]);

  const visibleKeys = React.useMemo(() => {
    const keys: string[] = [];
    const visit = (nodes: ImapFolder[]) =>
      nodes.forEach((folder) => {
        const node = Array.from(index.values()).find(
          (candidate) =>
            candidate.folder === folder ||
            (candidate.folder.path === folder.path &&
              (candidate.folder.accountId ?? accountId) ===
                (folder.accountId ?? accountId)),
        );
        if (!node) return;
        keys.push(node.key);
        const id = realFolderId(folder);
        if (
          id !== null &&
          expanded.has(expansionKey(folder.accountId ?? accountId, id))
        )
          visit(folder.children ?? []);
      });
    visit(tree);
    return keys;
  }, [accountId, expanded, index, tree]);

  React.useEffect(() => {
    if (focusedKey === null || !visibleKeys.includes(focusedKey))
      setFocusedKey(visibleKeys[0] ?? null);
  }, [focusedKey, visibleKeys]);

  const focus = (key?: string | null) => {
    if (!key) return;
    setFocusedKey(key);
    refs.current.get(key)?.focus();
  };

  const toggle = (folder: ImapFolder) => {
    const id = realFolderId(folder);
    if (id === null) return;
    const key = expansionKey(folder.accountId ?? accountId, id);
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    persistExpansion(next);
  };

  const renderNodes = (nodes: ImapFolder[]): React.ReactNode =>
    nodes.map((folder) => {
      const node = Array.from(index.values()).find(
        (candidate) =>
          candidate.folder === folder ||
          (candidate.folder.path === folder.path &&
            (candidate.folder.accountId ?? accountId) ===
              (folder.accountId ?? accountId)),
      );
      if (!node) return null;
      const folderAccountId = folder.accountId ?? accountId;
      const folderId = realFolderId(folder);
      const hasChildren = Boolean(folder.children?.length);
      const isExpanded =
        folderId !== null &&
        expanded.has(expansionKey(folderAccountId, folderId));
      const isSelected =
        folder.selectable !== false &&
        (selectedTarget
          ? selectedTarget.accountId === folderAccountId &&
            selectedTarget.folderId === folderId &&
            selectedTarget.path === folder.path
          : folder.path === selectedPath);
      const target: ProviderFolderTarget = {
        accountId: folderAccountId,
        folderId,
        path: folder.path,
        label: node.label,
        folder,
      };
      const position = visibleKeys.indexOf(node.key);
      const select = () => folder.selectable !== false && onSelect(target);
      const row = (
        <div
          ref={(element) => {
            if (element) refs.current.set(node.key, element);
            else refs.current.delete(node.key);
          }}
          role="treeitem"
          aria-level={node.level}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-selected={folder.selectable !== false ? isSelected : undefined}
          aria-disabled={folder.selectable === false || undefined}
          aria-label={node.label}
          data-test="folder-item"
          data-folder={folder.path}
          data-testid={
            testIdPrefix
              ? `${testIdPrefix}-${folder.path.replace(/[^a-zA-Z0-9_-]/g, "-")}`
              : undefined
          }
          data-folder-id={folderId ?? undefined}
          data-folder-path={folder.path}
          tabIndex={focusedKey === node.key ? 0 : -1}
          onFocus={() => setFocusedKey(node.key)}
          onClick={select}
          onKeyDown={(event) => {
            if (
              event.key === "ArrowDown" ||
              event.key === "ArrowUp" ||
              event.key === "Home" ||
              event.key === "End"
            ) {
              event.preventDefault();
              focus(
                event.key === "ArrowDown"
                  ? visibleKeys[position + 1]
                  : event.key === "ArrowUp"
                    ? visibleKeys[position - 1]
                    : event.key === "Home"
                      ? visibleKeys[0]
                      : visibleKeys[visibleKeys.length - 1],
              );
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              if (hasChildren && !isExpanded) toggle(folder);
              else if (hasChildren) focus(visibleKeys[position + 1]);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              if (hasChildren && isExpanded) toggle(folder);
              else focus(node.parentKey);
            } else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              select();
            }
          }}
          className={cn(
            "group/folder-tree relative w-full rounded-r-full outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring",
            SIDEBAR_NAV_ITEM_CLASS,
            folder.selectable === false
              ? "cursor-default text-muted-foreground"
              : "cursor-pointer hover:bg-muted",
            isSelected && "bg-primary/10 text-primary",
            mobile && "min-h-11 py-2",
            compact && "justify-center px-1",
          )}
          style={
            compact
              ? undefined
              : { paddingLeft: `${(node.level - 1) * 14 + 8}px` }
          }>
          {hasChildren && folderId !== null ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.label}`}
              onClick={(event) => {
                event.stopPropagation();
                toggle(folder);
              }}
              className={cn(
                SIDEBAR_NAV_ICON_CLASS,
                "flex items-center justify-center rounded-sm hover:text-foreground",
              )}>
              {isExpanded ? (
                <FolderOpen className={SIDEBAR_NAV_ICON_CLASS} />
              ) : (
                <Folder className={SIDEBAR_NAV_ICON_CLASS} />
              )}
            </button>
          ) : (
            <Folder className={SIDEBAR_NAV_ICON_CLASS} />
          )}
          {!compact && (
            <span className="min-w-0 flex-1 truncate" title={node.label}>
              {node.label}
            </span>
          )}
          {!compact &&
          (Boolean(folder.unseen) || (folderId !== null && renderTrailing)) ? (
            <span
              className="flex shrink-0 items-center gap-1"
              data-test="folder-trailing-cluster">
              {Boolean(folder.unseen) && (
                <span
                  className="shrink-0 text-xs font-semibold"
                  data-test="folder-unseen-count">
                  {folder.unseen}
                </span>
              )}
              {folderId !== null && renderTrailing ? (
                <span
                  className="shrink-0"
                  data-test="folder-trailing-actions"
                  onClick={(event) => event.stopPropagation()}>
                  {renderTrailing(target)}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      );
      return (
        <React.Fragment key={node.key}>
          {folderId !== null && folder.selectable !== false ? (
            <StableDropSurface target={target}>{row}</StableDropSurface>
          ) : (
            row
          )}
          {hasChildren && isExpanded && renderNodes(folder.children ?? [])}
        </React.Fragment>
      );
    });

  return (
    <div
      role="tree"
      aria-label="Provider folders"
      className={cn("min-w-0", mobile && "max-w-full", className)}>
      {renderNodes(tree)}
    </div>
  );
}

export default ProviderFolderTree;
