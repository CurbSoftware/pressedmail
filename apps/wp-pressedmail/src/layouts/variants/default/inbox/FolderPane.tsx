"use client";

/**
 * Folder Pane (Column 2)
 *
 * Displays the folder hierarchy for the current account:
 * - Header: Account email address + folder options menu
 * - Body: Scrollable folder tree (primary/admin/custom zones)
 * - Actions: Refresh + All Mail/Unread filter buttons
 * - Footer: SidebarFooter
 *
 * Extracted from the inline sidebar logic in the original Layout.tsx.
 *
 * @since 3.0.0
 */

import * as React from "react";
import { __ } from "@wordpress/i18n";
import {
  Inbox,
  Trash2,
  Send,
  FileText,
  Archive,
  FolderPlus,
  Star,
  Mails,
  Mail,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import {
  EmailComposeNewIcon,
  EmailImportantIcon,
  EmailJunkIcon,
  EmailRefreshIcon,
} from "@/components/icons/MailActionIcons";
import {
  ScheduledFolderIcon,
  SnoozeClockIcon,
} from "@/components/icons/FolderIcons";
import { cn } from "@/lib/utils";
import { folderBadgeCount } from "@/lib/folder-badge";
import { computeSyncFrontier } from "@/hooks/useMailboxSyncProgress";
import { Button, ScrollArea, Separator } from "@kit/ui/plugin";
import { FolderCrudPopover } from "@/layouts/shared/components/FolderCrudPopover";
import { FolderRowActions } from "@/layouts/shared/components/FolderRowActions";
import {
  DroppableFolder,
  useDragDropContext,
} from "@/components/shared/drag-drop";
import { useAppContext } from "@/context/AppProvider";
import { usePaneCompose } from "@/context/composer";
import { useMailOperations } from "@/layouts/shared/hooks/useMailOperations";
import { useFolderOperations } from "@/layouts/shared/hooks/useFolderOperations";
import type { FolderOperationResult } from "@/layouts/shared/hooks/useFolderOperations";
import { useMailboxScope } from "@/hooks/useMailboxScope";
import { CombinedInboxAccountsList } from "@/layouts/shared/components/CombinedInboxAccountsList";
import {
  ProviderFolderTree,
  filterProviderFolderTree,
  getNearestSelectableFolderAncestor,
  type ProviderFolderTarget,
} from "@/layouts/shared/components/ProviderFolderTree";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { TagFilterSection } from "@/components/tags/TagFilterSection";
import {
  STANDARD_FOLDER_ORDER,
  VIRTUAL_VIEW_ORDER,
} from "@/layouts/shared/folders/standard-folder-order";
import type { ImapFolder, SystemFolderType } from "@/services/interfaces";

const MAILBOX_VIEW_ORDER: SystemFolderType[] = STANDARD_FOLDER_ORDER.flatMap(
  (type) => {
    if (type === "inbox") return ["inbox", "important", "starred"];
    if (type === "snoozed") return ["scheduled", "snoozed"];
    return [type];
  },
);

export interface FolderPaneProps {
  /** Whether the pane is collapsed to icon-only mode */
  isCollapsed?: boolean;
  /** Optional override for tests/hosts; defaults to the active folder operation. */
  onCreateFolder?: (name: string) => Promise<FolderOperationResult>;
  className?: string;
}

// System folder type to icon mapping
const SYSTEM_FOLDER_ICONS: Record<string, LucideIcon> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileText,
  trash: Trash2,
  spam: EmailJunkIcon,
  junk: EmailJunkIcon,
  archive: Archive,
  starred: Star,
  flagged: Star,
  important: EmailImportantIcon,
  snoozed: SnoozeClockIcon,
  scheduled: ScheduledFolderIcon,
  outbox: Send,
  templates: FileText,
};

// System folders that always render (real or virtual) so every inbox reads the
// same, even before its folder list has loaded.
const ALWAYS_VISIBLE_TYPES = new Set<SystemFolderType>([
  "inbox",
  "sent",
  "drafts",
  "archive",
  // Junk/Spam is always reachable; the backend ensures a real server folder.
  "spam",
  "junk",
  "trash",
  // Snoozed is local workflow state; always reachable through its DB-backed view.
  "snoozed",
]);

function getSelectableFolderPath(folder: {
  path: string;
  systemType?: SystemFolderType;
}): string {
  return folder.path;
}

export function FolderPane({
  isCollapsed = false,
  onCreateFolder,
  className,
}: FolderPaneProps) {
  const { accounts, setIsAddAccount, setSelectedAccount } = useAppContext();
  const { isCombinedInbox, scope, accountIds } = useMailboxScope();
  const paneCompose = usePaneCompose();
  const { isLoading, isRefreshing, filterByReadStatus, filteredMessages } =
    useMailOperations();
  const {
    normalizedFolders,
    folders = [],
    virtualFolderCounts,
    selectedFolder,
    selectedFolderTarget,
    selectFolder,
    selectedNav,
    provider,
    createFolder,
    renameFolder,
    deleteFolder,
    refreshFolders,
  } = useFolderOperations();
  const scheduledVirtualEnabled = __ENABLE_SCHEDULED_EMAILS__ && !__IS_FREE__;
  const [mailboxOpen, setMailboxOpen] = React.useState(true);
  const [foldersOpen, setFoldersOpen] = React.useState(true);
  const [createdParentId, setCreatedParentId] = React.useState<number | null>(
    null,
  );
  const activeAccountId = accountIds[0] ?? 0;
  const providerFolders = React.useMemo<ImapFolder[]>(
    () =>
      folders.length > 0
        ? folders
        : normalizedFolders.map(
            ({ id: _id, displayCount: _displayCount, ...folder }) => folder,
          ),
    [folders, normalizedFolders],
  );
  const customFolderTree = React.useMemo(
    () =>
      filterProviderFolderTree(
        providerFolders,
        (folder) =>
          !folder.systemType &&
          !folder.path.startsWith("pressedmail-account://"),
      ),
    [providerFolders],
  );
  const combinedAccountTrees = React.useMemo(
    () =>
      folders.flatMap((folder) =>
        typeof folder.id === "number" && folder.id < 0 && folder.accountId
          ? [{ accountId: folder.accountId, folders: folder.children ?? [] }]
          : [],
      ),
    [folders],
  );

  // Categorize folders: one ordered standard block + the custom remainder.
  const { standardLinks } = React.useMemo(() => {
    const getSystemLabel = (type: SystemFolderType) => {
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
    };

    // The syncing spinner shows on ONE folder at a time, the current frontier
    // (first still-mirroring folder in canonical order, inbox first), so the
    // mailbox fills visibly one folder after another, not all at once.
    const syncFrontier = computeSyncFrontier(normalizedFolders);

    const buildFolderLink = (folder: (typeof normalizedFolders)[number]) => {
      const selectablePath = getSelectableFolderPath(folder);
      const isActive =
        selectedNav === selectablePath ||
        selectedNav === folder.path ||
        selectedNav === folder.name;
      return {
        title: folder.systemType
          ? getSystemLabel(folder.systemType)
          : folder.name,
        path: selectablePath,
        label: folder.displayCount.toString(),
        unseenCount: folderBadgeCount(folder) ?? 0,
        icon:
          (folder.systemType && SYSTEM_FOLDER_ICONS[folder.systemType]) ||
          Inbox,
        onClick: () => selectFolder(selectablePath),
        variant: isActive ? ("default" as const) : ("ghost" as const),
        isActive,
        systemType: folder.systemType,
        countPartial: false,
        syncing: folder.path === syncFrontier,
      };
    };

    const getFallbackPath = (type: SystemFolderType) => {
      switch (type) {
        case "inbox":
          return "INBOX";
        case "starred":
        case "flagged":
          return "starred";
        case "important":
          return "important";
        case "drafts":
          return "Drafts";
        case "sent":
          return "Sent";
        case "archive":
          return "Archive";
        case "trash":
          return "Trash";
        case "spam":
        case "junk":
          return "Junk";
        case "snoozed":
          return "snoozed";
        default:
          return type;
      }
    };

    const getVirtualCount = (type: SystemFolderType) => {
      if (type === "inbox") {
        return { count: filteredMessages.length, partial: false };
      }
      if (type === "starred" || type === "flagged") {
        return virtualFolderCounts.starred;
      }
      if (type === "important") {
        return virtualFolderCounts.important;
      }
      if (type === "scheduled") {
        return {
          count: virtualFolderCounts.scheduled ?? 0,
          partial: false,
        };
      }
      return { count: 0, partial: false };
    };

    const buildFallbackSystemLink = (
      type: SystemFolderType,
      options?: { onClick?: () => void },
    ) => {
      const path = getFallbackPath(type);
      const isActive = selectedNav === path || selectedNav === type;
      const count = getVirtualCount(type);
      return {
        title: getSystemLabel(type),
        path,
        label: count.count > 0 ? count.count.toString() : "",
        unseenCount: count.count,
        countPartial: count.partial,
        icon: SYSTEM_FOLDER_ICONS[type] || Inbox,
        onClick: options?.onClick ?? (() => selectFolder(path)),
        variant: isActive ? ("default" as const) : ("ghost" as const),
        isActive,
        systemType: type,
        // Fallback/virtual slots are not real mirrored folders, so they never
        // carry the spinner, only the frontier real folder does.
        syncing: false,
      };
    };

    const allLinks = normalizedFolders.map(buildFolderLink);

    const getSystemLink = (type: SystemFolderType) =>
      allLinks.find((link) => link.systemType === type);

    // One fixed-order system block: Inbox, Important, Starred, Sent, Drafts,
    // Archive, Junk, Trash, Scheduled, Snoozed. Each slot shows the real folder,
    // local workflow view, always-on fallback for core/virtual slots, or a
    // unavailable workflow views are omitted from builds that do not include
    // their implementation.
    const standard = MAILBOX_VIEW_ORDER.flatMap((type) => {
      const realLink = getSystemLink(type);

      if (type === "important" || type === "starred" || type === "flagged") {
        return [buildFallbackSystemLink(type)];
      }

      if (type === "scheduled") {
        if (scheduledVirtualEnabled) {
          return [buildFallbackSystemLink("scheduled")];
        }
        return [];
      }

      if (type === "snoozed" && __IS_FREE__) {
        return [];
      }

      if (realLink) return [realLink];

      if (type === "snoozed") {
        return [buildFallbackSystemLink("snoozed")];
      }

      if (ALWAYS_VISIBLE_TYPES.has(type)) {
        return [buildFallbackSystemLink(type)];
      }

      return [];
    });

    // Everything not in the standard block (real custom folders + rarer system
    // types like Outbox/Templates) stays reachable in provider order.
    return { standardLinks: standard };
  }, [
    normalizedFolders,
    virtualFolderCounts,
    filteredMessages,
    selectedNav,
    selectFolder,
    scheduledVirtualEnabled,
  ]);

  const { isDragging } = useDragDropContext();

  const handleRenameFolder = async (
    path: string,
    newName: string,
    parentId?: number | null,
  ) => {
    return renameFolder(path, newName, parentId);
  };

  const handleDeleteFolder = async (path: string) => {
    const fallback = getNearestSelectableFolderAncestor(
      customFolderTree,
      activeAccountId,
      path,
    );
    const result = await deleteFolder(path);
    if (result.success && selectedFolderTarget?.path === path) {
      selectFolder(fallback ?? "INBOX");
    }
    return result;
  };

  const handleCompose = React.useCallback(() => {
    if (accounts.length === 0) {
      setIsAddAccount(true);
      return;
    }

    paneCompose?.requestPaneCompose();
  }, [accounts.length, paneCompose, setIsAddAccount]);

  const actionButtons = React.useMemo(
    () => [
      {
        id: "compose",
        label: __("Compose", "pressedmail"),
        icon: EmailComposeNewIcon,
        onClick: handleCompose,
        disabled: false,
        testId: "folder-sidebar-compose",
      },
      {
        id: "refresh",
        label:
          isLoading || isRefreshing
            ? __("Loading...", "pressedmail")
            : __("Refresh", "pressedmail"),
        icon: EmailRefreshIcon,
        // Force a LIVE folder recount + message refresh (re-bootstraps a
        // stalled mirror), not just a mirror re-read of the same empty rows.
        onClick: () => refreshFolders(),
        disabled: isLoading || isRefreshing,
        testId: "folder-sidebar-refresh",
        spinning: isLoading || isRefreshing,
      },
      {
        id: "all-mail",
        label: __("All mail", "pressedmail"),
        icon: Mails,
        onClick: () => filterByReadStatus("all"),
        disabled: false,
        testId: "folder-sidebar-all-mail",
      },
      {
        id: "unread",
        label: __("Unread", "pressedmail"),
        icon: Mail,
        onClick: () => filterByReadStatus("unread"),
        disabled: false,
        testId: "folder-sidebar-unread",
      },
    ],
    [
      filterByReadStatus,
      handleCompose,
      isLoading,
      isRefreshing,
      refreshFolders,
    ],
  );
  const renderedActionLayout = isCollapsed ? "collapsed" : "stacked";

  return (
    <div className={cn("flex flex-col h-full min-h-0", className)}>
      {/* Actions: Refresh + filters */}
      <div
        data-test="folder-actions-row"
        data-action-layout={renderedActionLayout}
        className={cn(
          "shrink-0 px-2 py-1.5",
          isCollapsed
            ? "flex flex-col items-center justify-center gap-1"
            : "grid grid-cols-2 gap-1.5",
        )}>
        {isCollapsed
          ? actionButtons.map((action) => {
              const Icon = action.icon;
              return (
                <PressedTooltip
                  key={action.id}
                  content={action.label}
                  side="right">
                  <Button
                    variant={action.id === "compose" ? "default" : "outline"}
                    size="icon"
                    disabled={action.disabled}
                    onClick={action.onClick}
                    data-test={action.testId}
                    className="h-8 w-8 shrink-0"
                    aria-label={action.label}>
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5",
                        action.spinning && "animate-spin",
                      )}
                    />
                  </Button>
                </PressedTooltip>
              );
            })
          : actionButtons.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  variant={action.id === "compose" ? "default" : "outline"}
                  size="sm"
                  disabled={action.disabled}
                  onClick={action.onClick}
                  data-test={action.testId}
                  className={cn(
                    "h-8 w-full min-w-0 gap-1.5 px-2 justify-center",
                    action.id === "compose"
                      ? "text-sm font-extrabold"
                      : "text-xs",
                  )}
                  aria-label={action.label}>
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      action.spinning && "animate-spin",
                    )}
                  />
                  <span className="truncate">{action.label}</span>
                </Button>
              );
            })}
      </div>

      <Separator />

      {/* Body: Scrollable folder tree */}
      <ScrollArea
        className="flex-1 min-h-0"
        data-test="folder-sidebar-scrollarea">
        <div className="flex flex-col">
          {/* Mailbox system views */}
          <div
            data-test="mailbox-section"
            data-collapsed={isCollapsed}
            className="group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2">
            <div className="px-2 py-1">
              {!isCollapsed && (
                <button
                  type="button"
                  aria-expanded={mailboxOpen}
                  data-test="mailbox-section-toggle"
                  onClick={() => setMailboxOpen((value) => !value)}
                  className="-my-1 inline-flex min-h-6 items-center text-2xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground">
                  {__("Mailbox", "pressedmail")}
                </button>
              )}
            </div>
            {(isCollapsed || mailboxOpen) && (
              <nav
                data-test="folder-list"
                className={cn(
                  "grid gap-1 px-2",
                  isCollapsed && "justify-center px-2",
                )}>
                {standardLinks.map((link) => (
                  <DroppableFolder
                    key={link.path}
                    id={link.path}
                    label={link.title}
                    icon={link.icon}
                    isActive={link.isActive}
                    unseenCount={link.unseenCount}
                    countPartial={link.countPartial}
                    onClick={link.onClick}
                    isCollapsed={isCollapsed}
                    syncing={link.syncing}
                  />
                ))}
              </nav>
            )}
          </div>

          {/* Combined Inbox accounts, below the Mailbox folders; drill into a
              single account's inbox. Custom folders stay hidden in combined mode. */}
          {isCombinedInbox && (
            <>
              <Separator className="my-2" />
              <CombinedInboxAccountsList
                accountIds={
                  scope.type === "combined_inbox" ? scope.accountIds : []
                }
                accounts={accounts}
                onSelectAccount={setSelectedAccount}
                isCollapsed={isCollapsed}
                className="py-2"
              />
              {!isCollapsed &&
                combinedAccountTrees.map((group) => {
                  const account = accounts.find(
                    (item) => Number(item.id) === group.accountId,
                  );
                  return (
                    <section key={group.accountId} className="px-2 pb-2">
                      <h3 className="truncate px-2 py-1 text-xs font-semibold text-muted-foreground">
                        {account?.email ?? `Account ${group.accountId}`}
                      </h3>
                      <ProviderFolderTree
                        accountId={group.accountId}
                        folders={group.folders}
                        selectedPath={selectedFolder}
                        selectedTarget={selectedFolderTarget}
                        onSelect={selectFolder}
                      />
                    </section>
                  );
                })}
            </>
          )}

          {/* Provider folders and labels, hidden in combined mode (custom
              folders are never merged across accounts; drill into one account). */}
          {!isCombinedInbox && (
            <>
              <Separator className="my-2" />
              <div data-test="provider-folders-labels-section">
                <div className="px-2 py-1 flex items-center justify-between">
                  {!isCollapsed && (
                    <button
                      type="button"
                      aria-expanded={foldersOpen}
                      data-test="folders-section-toggle"
                      onClick={() => setFoldersOpen((value) => !value)}
                      className="-my-1 inline-flex min-h-6 items-center text-2xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground">
                      {__("Folders / Labels", "pressedmail")}
                    </button>
                  )}
                  <FolderCrudPopover
                    mode="create"
                    accountId={activeAccountId || undefined}
                    folders={customFolderTree}
                    providerLabel={provider === "gmail" ? "label" : "folder"}
                    onCreate={onCreateFolder ?? createFolder}
                    onSuccess={({ parentId }) => {
                      setCreatedParentId(parentId ?? null);
                      void refreshFolders();
                    }}>
                    <button
                      type="button"
                      className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={
                        provider === "gmail"
                          ? __("New label", "pressedmail")
                          : __("New folder", "pressedmail")
                      }>
                      <FolderPlus className="h-3.5 w-3.5" />
                    </button>
                  </FolderCrudPopover>
                </div>
                {(isCollapsed || foldersOpen) &&
                  (customFolderTree.length > 0 ? (
                    <div
                      data-collapsed={isCollapsed}
                      className="group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2">
                      <nav
                        className={cn(
                          "grid gap-1 px-2",
                          isCollapsed && "justify-center px-2",
                        )}>
                        <ProviderFolderTree
                          accountId={activeAccountId}
                          folders={customFolderTree}
                          selectedPath={selectedFolder}
                          selectedTarget={selectedFolderTarget}
                          expandFolderId={createdParentId}
                          compact={isCollapsed}
                          onSelect={selectFolder}
                          renderTrailing={(target: ProviderFolderTarget) => (
                            <FolderRowActions
                              target={target}
                              accountId={activeAccountId}
                              folders={customFolderTree}
                              provider={provider}
                              onRename={handleRenameFolder}
                              onDelete={handleDeleteFolder}
                            />
                          )}
                        />
                      </nav>
                    </div>
                  ) : (
                    !isCollapsed && (
                      <p className="text-xs text-muted-foreground italic px-4 py-1">
                        {provider === "gmail"
                          ? __("No labels yet", "pressedmail")
                          : __("No folders yet", "pressedmail")}
                      </p>
                    )
                  ))}
              </div>
            </>
          )}

          {/* PressedMail tags, always below all folders */}
          <Separator className="my-2" />
          <TagFilterSection isCollapsed={isCollapsed} className="px-0 pb-2" />

          {/* Drag hint */}
          {isDragging && !isCollapsed && (
            <div className="px-4 py-2 text-[11px] text-muted-foreground text-center animate-in fade-in duration-200">
              {__("Drop on a folder to move", "pressedmail")}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default FolderPane;
