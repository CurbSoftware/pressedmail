"use client";

import { __ } from "@wordpress/i18n";

/**
 * Default Layout Component
 *
 * The default inbox layout with three resizable panes:
 * - Left: Folder navigation
 * - Center: Message list with infinite scroll
 * - Right: Reading pane
 *
 * Available in Free + Pro tiers.
 *
 * @since 1.2.0
 */

import * as React from "react";
import { Inbox, Trash2, Send, FileText, Archive, Menu } from "lucide-react";
import {
  EmailComposeNewIcon,
  EmailJunkIcon,
  EmailRefreshIcon,
} from "@/components/icons/MailActionIcons";

import { MailList } from "@/components/inbox/mail-list";
import { MailListSkeleton } from "@/components/inbox/mail-list-skeleton";
import { Nav } from "@/components/inbox/nav";
import { RightPaneContainer } from "@/components/inbox/RightPaneContainer";
import { CONSOLIDATED_INBOX_VALUE } from "@/components/inbox/account-switcher";

import { useAppContext } from "@/context/AppProvider";
import { usePaneCompose } from "@/context/composer";
import {
  useInboxState,
  useInbox,
  useFolderOperations as useInboxFolderOperations,
  useFilterOperations,
} from "@/context/InboxContext";
import { cn } from "@/lib/utils";
import {
  readPanelLayoutFromCookie,
  writePanelLayoutCookie,
} from "@/layouts/shared/utils/panelLayout";
import {
  buildConsolidatedAccountScopeKey,
  getEffectiveConsolidatedAccountIds,
} from "@/lib/consolidated-account-scope";
import type { MailProps } from "@/types";
import type { LayoutConfig } from "@/types/features";

import {
  Button,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ScrollArea,
  Separator,
  TooltipProvider,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@kit/ui/plugin";

export interface DefaultLayoutProps extends Omit<MailProps, "mails"> {
  /** Optional messages (layouts get these from context) */
  mails?: MailProps["mails"];
  layoutConfig?: LayoutConfig;
}

export function DefaultLayout({
  accounts,
  defaultLayout = [20, 30, 50],
  defaultCollapsed = false,
  navCollapsedSize,
  showComposer = true,
  layoutConfig,
}: DefaultLayoutProps) {
  const resolvedLayout = React.useMemo(
    () =>
      readPanelLayoutFromCookie("pressedm", {
        expectedLength: 3,
        fallbackToShared: true,
      }) ?? defaultLayout,
    [defaultLayout],
  );
  // Track sidebar size to auto-collapse when narrow
  const [sidebarSize, setSidebarSize] = React.useState(
    resolvedLayout[0] ?? defaultLayout[0] ?? 20,
  );
  // Collapse to icons-only when sidebar is below 17% width
  const isCollapsed = defaultCollapsed || sidebarSize < 17;
  const [showFolderSheet, setShowFolderSheet] = React.useState(false);
  const { selectedAccount, selectedConsolidatedAccountIds, setIsAddAccount } =
    useAppContext();
  const paneCompose = usePaneCompose();
  const handleComposeClick = React.useCallback(() => {
    if (accounts.length === 0) {
      setIsAddAccount(true);
      return;
    }
    paneCompose?.requestPaneCompose();
  }, [accounts.length, paneCompose, setIsAddAccount]);
  const {
    messages: filteredMessages,
    selectedMessage,
    isLoading,
    hasMore,
    isLoadingMore,
  } = useInboxState();
  const {
    refreshMessages,
    loadMore,
    loadMessages: inboxLoadMessages,
  } = useInbox();
  const { folders: imapFolders } = useInboxFolderOperations();
  const { applyFilters } = useFilterOperations();

  // Local nav state (previously from MessagesProvider)
  const [selectedNav, setSelectedNav] = React.useState("Inbox");

  const fallbackInboxCount = filteredMessages.length;
  const isConsolidatedMode = selectedAccount === CONSOLIDATED_INBOX_VALUE;
  const effectiveConsolidatedAccountIds = React.useMemo(
    () =>
      isConsolidatedMode
        ? getEffectiveConsolidatedAccountIds(
            accounts,
            selectedConsolidatedAccountIds,
          )
        : [],
    [accounts, isConsolidatedMode, selectedConsolidatedAccountIds],
  );
  const consolidatedScopeKey = React.useMemo(
    () => buildConsolidatedAccountScopeKey(effectiveConsolidatedAccountIds),
    [effectiveConsolidatedAccountIds],
  );
  const loadFolderForCurrentAccount = React.useCallback(
    async (folderPath: string) => {
      if (isConsolidatedMode) {
        await inboxLoadMessages({
          accountId: consolidatedScopeKey,
          accountIds: effectiveConsolidatedAccountIds,
          folder: folderPath,
          consolidated: true,
        });
        return;
      }

      const currentAccount = accounts.find(
        (account) => account.email?.toString() === selectedAccount,
      );
      if (currentAccount?.id) {
        const resolvedId = Number(currentAccount.id) || 1;
        await inboxLoadMessages({
          accountId: resolvedId,
          folder: folderPath,
        });
      }
    },
    [
      accounts,
      consolidatedScopeKey,
      effectiveConsolidatedAccountIds,
      inboxLoadMessages,
      isConsolidatedMode,
      selectedAccount,
    ],
  );

  // Deduplicate IMAP folders by name (case-insensitive)
  const deduplicatedFolders = React.useMemo(() => {
    const seen = new Set<string>();
    return imapFolders.filter((folder) => {
      const key = folder.name.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [imapFolders]);

  // Lazy loading trigger element ref
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  // JUSTIFICATION: useEffect required for IntersectionObserver lifecycle management.
  // Observer must be created after ref is mounted and cleaned up on unmount.
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target?.isIntersecting && hasMore && !isLoadingMore) {
          loadMore?.();
        }
      },
      { threshold: 0.1, rootMargin: "200px" },
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, isLoadingMore, loadMore]);

  // Helper to get folder icon
  const getFolderIcon = (folderName: string) => {
    const name = folderName.toLowerCase();
    if (name === "inbox") return Inbox;
    if (name === "sent") return Send;
    if (name === "drafts") return FileText;
    if (name === "trash" || name === "deleted") return Trash2;
    if (name === "junk" || name === "spam") return EmailJunkIcon;
    if (name === "archive") return Archive;
    return Inbox;
  };

  // Define primary and administrative folder names
  const PRIMARY_FOLDERS = ["inbox", "sent", "drafts"];
  const ADMIN_FOLDERS = ["archive", "junk", "spam", "trash", "deleted"];

  // Build folder links and split into primary/administrative/custom
  const { primaryLinks, adminLinks, customLinks } = React.useMemo(() => {
    const buildFolderLink = (folder: {
      name: string;
      path: string;
      count?: number;
      unseen?: number;
    }) => {
      const folderNameLower = folder.name.toLowerCase();
      const folderLabelNumber = folder.count ?? 0;
      const isAdmin = ADMIN_FOLDERS.includes(folderNameLower);

      return {
        title: folder.name,
        label: folderLabelNumber.toString(),
        icon: getFolderIcon(folder.name),
        onClick: async () => {
          setSelectedNav(folder.name);
          await loadFolderForCurrentAccount(folder.path);
        },
        variant:
          selectedNav === folder.name
            ? ("default" as const)
            : ("ghost" as const),
        isAdmin,
      };
    };

    if (deduplicatedFolders.length === 0) {
      return {
        primaryLinks: [
          {
            title: "Inbox",
            label: fallbackInboxCount.toString(),
            icon: Inbox,
            onClick: async () => {
              setSelectedNav("Inbox");
              await loadFolderForCurrentAccount("INBOX");
            },
            variant:
              selectedNav === "Inbox"
                ? ("default" as const)
                : ("ghost" as const),
            isAdmin: false,
          },
        ],
        adminLinks: [] as ReturnType<typeof buildFolderLink>[],
        customLinks: [] as ReturnType<typeof buildFolderLink>[],
      };
    }

    const allLinks = deduplicatedFolders.map(buildFolderLink);

    // Sort primary folders to ensure correct order: Inbox, Sent, Drafts
    const primary = allLinks
      .filter((link) => PRIMARY_FOLDERS.includes(link.title.toLowerCase()))
      .sort((a, b) => {
        const aIndex = PRIMARY_FOLDERS.indexOf(a.title.toLowerCase());
        const bIndex = PRIMARY_FOLDERS.indexOf(b.title.toLowerCase());
        return aIndex - bIndex;
      });

    // Sort admin folders in specific order: Archive, Junk, Spam, Trash, Deleted
    const admin = allLinks
      .filter((link) => ADMIN_FOLDERS.includes(link.title.toLowerCase()))
      .sort((a, b) => {
        const aIndex = ADMIN_FOLDERS.indexOf(a.title.toLowerCase());
        const bIndex = ADMIN_FOLDERS.indexOf(b.title.toLowerCase());
        return aIndex - bIndex;
      });

    // Custom folders (not primary or admin) - sorted alphabetically
    const custom = allLinks
      .filter(
        (link) =>
          !PRIMARY_FOLDERS.includes(link.title.toLowerCase()) &&
          !ADMIN_FOLDERS.includes(link.title.toLowerCase()),
      )
      .sort((a, b) => a.title.localeCompare(b.title));

    return { primaryLinks: primary, adminLinks: admin, customLinks: custom };
  }, [
    deduplicatedFolders,
    fallbackInboxCount,
    selectedNav,
    loadFolderForCurrentAccount,
    setSelectedNav,
  ]);

  const renderSidebarContent = (collapsed: boolean) => (
    <>
      {/* Actions Zone */}
      <div className="flex flex-col">
        <div
          className={cn(
            "flex items-center gap-2 p-2 pb-0",
            collapsed && "justify-center",
          )}>
          <Button
            variant="default"
            size={collapsed ? "icon" : "sm"}
            onClick={handleComposeClick}
            className={cn(
              "font-extrabold",
              collapsed ? "h-9 w-9" : "flex-1 h-9 text-sm",
            )}
            title={collapsed ? __("Compose", "pressedmail") : undefined}>
            <EmailComposeNewIcon className="h-4 w-4" />
            {!collapsed && (
              <span className="ml-2 text-sm font-extrabold">
                {__("Compose", "pressedmail")}
              </span>
            )}
          </Button>
        </div>
        <div
          className={cn(
            "flex items-center gap-2 p-2",
            collapsed && "justify-center",
          )}>
          <Button
            variant="outline"
            size={collapsed ? "icon" : "sm"}
            disabled={isLoading}
            onClick={() => refreshMessages()}
            className={cn(collapsed ? "h-9 w-9" : "flex-1 h-9")}
            title={
              collapsed
                ? isLoading
                  ? __("Loading...", "pressedmail")
                  : __("Refresh", "pressedmail")
                : undefined
            }>
            <EmailRefreshIcon
              className={cn("h-4 w-4", isLoading && "animate-spin")}
            />
            {!collapsed && (
              <span className="ml-2">
                {isLoading
                  ? __("Loading...", "pressedmail")
                  : __("Refresh", "pressedmail")}
              </span>
            )}
          </Button>
        </div>
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyFilters({ readStatus: "all" })}
              className="flex-1 h-9">
              {__("All mail", "pressedmail")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyFilters({ readStatus: "unread" })}
              className="flex-1 h-9">
              {__("Unread", "pressedmail")}
            </Button>
          </div>
        )}
      </div>
      <Separator />

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col">
          {/* Primary Navigation Zone - Inbox, Sent, Drafts */}
          <Nav isCollapsed={collapsed} links={primaryLinks} />

          {/* Administrative Zone - Archive, Junk, Trash */}
          {adminLinks.length > 0 && (
            <>
              <Separator className="my-2" />
              <div className="px-2 py-1">
                {!collapsed && (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {__("More", "pressedmail")}
                  </span>
                )}
              </div>
              <Nav isCollapsed={collapsed} links={adminLinks} />
            </>
          )}

          {/* Custom Folders Zone */}
          {customLinks.length > 0 && (
            <>
              <Separator className="my-2" />
              <div className="px-2 py-1">
                {!collapsed && (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {__("Folders", "pressedmail")}
                  </span>
                )}
              </div>
              <Nav isCollapsed={collapsed} links={customLinks} />
            </>
          )}
        </div>
      </ScrollArea>
    </>
  );

  const sidebarContent = renderSidebarContent(isCollapsed);

  // Mail list content (search handled by header search bar)
  const mailListContent = (
    <div
      className="flex h-full flex-col"
      style={{ minHeight: 0, width: "100%", overflow: "hidden" }}>
      <div className="flex items-center gap-2 border-b px-3 py-2 lg:hidden">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowFolderSheet(true)}>
          <Menu className="h-4 w-4" />
          {__("Folders", "pressedmail")}
        </Button>
      </div>
      <ScrollArea
        className="flex-1"
        style={{ minHeight: 0, width: "100%", maxWidth: "100%" }}>
        <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
          <MailList items={filteredMessages || []} />
          {isLoadingMore && hasMore && <MailListSkeleton count={3} />}
          <div
            ref={loadMoreRef}
            className="h-20 flex items-center justify-center px-3">
            {!hasMore && filteredMessages.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {__("No more emails", "pressedmail")}
              </p>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );

  // Reading pane with mode switcher (reading vs compose)
  const readingPaneContent = (
    <RightPaneContainer selectedMessage={selectedMessage} className="h-full" />
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div className="relative h-full min-h-0 w-full">
        <ResizablePanelGroup
          direction="horizontal"
          onLayout={(sizes: number[]) => {
            writePanelLayoutCookie("pressedm", sizes, { cleanupShared: true });
            // Track sidebar size for auto-collapse
            if (sizes[0] !== undefined) {
              setSidebarSize(sizes[0]);
            }
          }}
          className="h-full min-h-0 bg-background">
          <ResizablePanel
            id="folder"
            defaultSize={resolvedLayout[0]}
            collapsedSize={navCollapsedSize}
            collapsible={true}
            minSize={15}
            maxSize={20}
            className={cn(
              "hidden lg:flex bg-card min-h-0 flex-col rounded-md overflow-hidden",
              isCollapsed &&
                "min-w-[50px] transition-all duration-300 ease-in-out",
            )}>
            {sidebarContent}
          </ResizablePanel>
          <ResizableHandle withHandle className="hidden lg:flex" />
          <ResizablePanel
            id="list"
            defaultSize={resolvedLayout[1]}
            minSize={25}
            maxSize={40}
            className="flex min-h-0 w-full flex-col overflow-hidden rounded-lg bg-card">
            {mailListContent}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            id="reading"
            defaultSize={resolvedLayout[2]}
            minSize={35}
            className="flex min-h-0 w-full flex-col overflow-hidden rounded-lg bg-card">
            {readingPaneContent}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Folder Sheet overlay for narrow screens */}
      <Sheet open={showFolderSheet} onOpenChange={setShowFolderSheet}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="p-4 pb-2">
            <SheetTitle>{__("Folders", "pressedmail")}</SheetTitle>
          </SheetHeader>
          <div className="flex h-[calc(100%-3.5rem)] flex-col">
            {renderSidebarContent(false)}
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}

export default DefaultLayout;
