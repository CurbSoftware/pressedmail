"use client";
import * as React from "react";
import { __ } from "@wordpress/i18n";
import {
  Inbox,
  Trash2,
  Send,
  FileText,
  Archive,
} from "lucide-react";
import {
  EmailJunkIcon,
  EmailRefreshIcon,
} from "@/components/icons/MailActionIcons";

import { MailList } from "@/components/inbox/mail-list";
import { MailListPaginated } from "@/components/inbox/mail-list-paginated";
import { MailListSkeleton } from "@/components/inbox/mail-list-skeleton";
import { Nav } from "@/components/inbox/nav";
import { LayoutRouter } from "@/components/inbox/layouts";
import { RightPaneContainer } from "@/components/inbox/RightPaneContainer";
import { cn } from "@/lib/utils";
import {
  readPanelLayoutFromCookie,
  writePanelLayoutCookie,
} from "@/layouts/shared/utils/panelLayout";

import { useAppContext } from "@/context/AppProvider";
import {
  useInboxState,
  useInbox,
  useFilterOperations,
} from "@/context/InboxContext";
import { CONSOLIDATED_INBOX_VALUE } from "@/components/inbox/account-switcher";
import { useLayout } from "@/hooks/useLayout";
import { useFolderOperations as useSharedFolderOperations } from "@/layouts/shared/hooks/useFolderOperations";
import { useEmailRulesEnforcement } from "@/hooks/useEmailRulesEnforcement";

import type { MailProps } from "@/types";
import type { LayoutId } from "@/types/features";

import {
  Button,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ScrollArea,
  Separator,
  TooltipProvider,
} from "@kit/ui/plugin";
function MailCompInner({
  accounts,
  defaultLayout = [20, 30, 50],
  defaultCollapsed = false,
  navCollapsedSize,
  layoutVariant = "classic",
  listVariant = "default",
  pageSize = 50,
  showComposer = true,
}: MailProps) {
  const resolvedLayout = React.useMemo(
    () =>
      readPanelLayoutFromCookie("pressedm", {
        expectedLength: 3,
        fallbackToShared: true,
      }) ?? defaultLayout,
    [defaultLayout],
  );
  const isClassicLayout = layoutVariant === "classic";
  const isCollapsed = isClassicLayout ? defaultCollapsed : false;
  const { selectedAccount } = useAppContext();
  const {
    messages: filteredMessages,
    selectedMessage,
    isLoading,
    hasMore,
    isLoadingMore,
  } = useInboxState();
  const { refreshMessages, loadMore } = useInbox();
  const { normalizedFolders, selectedNav, selectFolder } =
    useSharedFolderOperations();
  const { applyFilters } = useFilterOperations();

  const numberOfMessages = filteredMessages.length;
  const fallbackInboxCount = filteredMessages.length;
  useEmailRulesEnforcement(filteredMessages);
  const isConsolidatedMode = selectedAccount === CONSOLIDATED_INBOX_VALUE;

  // Deduplicate IMAP folders by name (case-insensitive) to prevent duplicate entries
  const deduplicatedFolders = React.useMemo(() => {
    const seen = new Set<string>();
    return normalizedFolders.filter((folder) => {
      const key = folder.path.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [normalizedFolders]);

  // Lazy loading trigger element ref
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target?.isIntersecting && hasMore && !isLoadingMore) {
          loadMore?.();
        }
      },
      { threshold: 0.1, rootMargin: "200px" }, // Increased margin to trigger earlier
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

  const sidebarContent = (
    <>
      <div className="flex flex-col">
        <div className="flex items-center gap-2 p-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => refreshMessages()}
            className="flex-1">
            <EmailRefreshIcon
              className={cn("h-4 w-4", isLoading && "animate-spin")}
            />
            {!isCollapsed && (
              <span className="ml-2">
                {isLoading
                  ? __("Loading...", "pressedmail")
                  : __("Refresh", "pressedmail")}
              </span>
            )}
          </Button>
        </div>
        <div className="flex items-center gap-2 px-2 pb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyFilters({ readStatus: "all" })}
            className="flex-1">
            {__("All mail", "pressedmail")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyFilters({ readStatus: "unread" })}
            className="flex-1">
            {__("Unread", "pressedmail")}
          </Button>
        </div>
      </div>
      <Separator />
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col">
          <Nav
            isCollapsed={isCollapsed}
            links={
              isConsolidatedMode
                ? [
                    { name: "Inbox", path: "INBOX", icon: Inbox },
                    { name: "Sent", path: "Sent", icon: Send },
                    { name: "Drafts", path: "Drafts", icon: FileText },
                    { name: "Trash", path: "Trash", icon: Trash2 },
                    { name: "Spam", path: "Spam", icon: EmailJunkIcon },
                    { name: "Archive", path: "Archive", icon: Archive },
                  ].map((folder) => ({
                    title: folder.name,
                    label:
                      folder.name === "Inbox"
                        ? fallbackInboxCount.toString()
                        : "",
                    icon: folder.icon,
                    onClick: () => selectFolder(folder.path),
                    variant:
                      selectedNav === folder.path
                        ? ("default" as const)
                        : ("ghost" as const),
                  }))
                : [
                    ...(deduplicatedFolders.length === 0
                      ? [
                          {
                            title: "Inbox",
                            label: fallbackInboxCount.toString(),
                            icon: Inbox,
                            onClick: () => selectFolder("INBOX"),
                            variant:
                              selectedNav === "INBOX"
                                ? ("default" as const)
                                : ("ghost" as const),
                          },
                        ]
                      : []),
                    ...deduplicatedFolders.map((folder) => {
                      let folderIcon = Inbox;
                      const folderNameLower = folder.name.toLowerCase();

                      if (folderNameLower === "inbox") {
                        folderIcon = Inbox;
                      } else if (folderNameLower === "sent") {
                        folderIcon = Send;
                      } else if (folderNameLower === "drafts") {
                        folderIcon = FileText;
                      } else if (
                        folderNameLower === "trash" ||
                        folderNameLower === "deleted"
                      ) {
                        folderIcon = Trash2;
                      } else if (
                        folderNameLower === "junk" ||
                        folderNameLower === "spam"
                      ) {
                        folderIcon = EmailJunkIcon;
                      } else if (folderNameLower === "archive") {
                        folderIcon = Archive;
                      }

                      const folderLabelNumber =
                        folder.unseen ?? folder.count ?? 0;

                      return {
                        title: folder.name,
                        label: folderLabelNumber.toString(),
                        icon: folderIcon,
                        onClick: () => selectFolder(folder.path),
                        variant:
                          selectedNav === folder.path
                            ? ("default" as const)
                            : ("ghost" as const),
                      };
                    }),
                  ]
            }
          />
        </div>
      </ScrollArea>
    </>
  );

  // Default mail list with lazy loading and scroll container (search handled by header)
  const defaultMailListContent = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ScrollArea className="flex-1 min-h-0">
        <MailList items={filteredMessages || []} />
        {isLoadingMore && hasMore && <MailListSkeleton count={3} />}
        <div
          ref={loadMoreRef}
          className="h-20 flex items-center justify-center">
          {!hasMore && filteredMessages.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {__("No more emails", "pressedmail")}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Paginated mail list for PressedG theme (search handled by header)
  const paginatedMailListContent = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden">
        <MailListPaginated pageSize={pageSize} />
      </div>
    </div>
  );

  // Select list content based on variant
  const mailListContent =
    listVariant === "paginated"
      ? paginatedMailListContent
      : defaultMailListContent;

  // Reading pane with proper compose functionality
  const readingPaneContent = (
    <RightPaneContainer selectedMessage={selectedMessage} className="h-full" />
  );

  if (!isClassicLayout) {
    return (
      <TooltipProvider delayDuration={0}>
        <div className="flex h-full gap-4 bg-background/60 p-4">
          <div
            className="flex w-64 flex-shrink-0 flex-col rounded-2xl border border-border bg-card shadow-sm"
            data-test="inbox-sidebar">
            {sidebarContent}
          </div>
          <div className="flex w-80 min-w-[300px] flex-shrink-0 flex-col rounded-2xl border border-border bg-card shadow-sm">
            {mailListContent}
          </div>
          <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            {readingPaneContent}
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <ResizablePanelGroup
        direction="horizontal"
        onLayout={(sizes: number[]) => {
          writePanelLayoutCookie("pressedm", sizes, { cleanupShared: true });
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
            "bg-card flex min-h-0 flex-col rounded-md overflow-hidden",
            isCollapsed &&
              "min-w-[50px] transition-all duration-300 ease-in-out",
          )}>
          {sidebarContent}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          id="list"
          defaultSize={resolvedLayout[1]}
          minSize={30}
          className="flex min-h-0 flex-col overflow-hidden">
          {mailListContent}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          id="reading"
          defaultSize={resolvedLayout[2]}
          className="flex min-h-0 flex-col overflow-hidden rounded-lg bg-card">
          {readingPaneContent}
        </ResizablePanel>
      </ResizablePanelGroup>
    </TooltipProvider>
  );
}

/** Valid layout IDs for the new layout system */
const VALID_LAYOUT_IDS: readonly LayoutId[] = [
  "pressedm",
  "pressedg",
  "pressedout",
];

export function MailComp({
  layoutVariant = "classic",
  listVariant = "default",
  showComposer = true,
  ...props
}: MailProps) {
  // Get the current layout from the layout hook
  const { currentLayout } = useLayout();

  // Use new layout system for valid layout IDs. LayoutRouter handles tier-based fallback.
  // Fixes sidebar visibility by bypassing build flag/whitelabel validation from useLayout().
  const useNewLayoutSystem = VALID_LAYOUT_IDS.includes(currentLayout);

  return (
    <div
      className="relative h-full min-h-0 w-full"
      data-test="inbox-container"
      data-layout={currentLayout}>
      {useNewLayoutSystem ? (
        <LayoutRouter
          accounts={props.accounts}
          navCollapsedSize={props.navCollapsedSize}
          showComposer={showComposer}
        />
      ) : (
        <MailCompInner
          {...props}
          layoutVariant={layoutVariant}
          listVariant={listVariant}
          showComposer={showComposer}
        />
      )}
    </div>
  );
}
