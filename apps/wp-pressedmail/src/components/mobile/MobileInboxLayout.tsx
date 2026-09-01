"use client";

import * as React from "react";
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  Archive,
  Search,
  Menu,
  ChevronLeft,
} from "lucide-react";
import {
  EmailComposeNewIcon,
  EmailJunkIcon,
  EmailRefreshIcon,
} from "@/components/icons/MailActionIcons";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@kit/ui/plugin";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/context/AppProvider";
import {
  useInbox,
  useInboxState,
  useMessageOperations,
  useFilterOperations,
  useSearchOperations as useInboxSearchOperations,
} from "@/context/InboxContext";
import { MailDisplay } from "@/components/inbox/mail-display";
import { EmailTagBadges } from "@/components/tags/EmailTagBadges";
import { TagFilterSection } from "@/components/tags/TagFilterSection";
import { MailListSkeleton } from "@/components/inbox/mail-list-skeleton";
import { MobileComposeSheet } from "./MobileComposeSheet";
import { SwipeActions } from "./SwipeActions";
import type { EmailMessage, EmailAccount } from "@/types";
import { ConnectionErrorBanner } from "@/layouts/shared/components/ConnectionErrorBanner";
import { useFolderOperations as useSharedFolderOperations } from "@/layouts/shared/hooks/useFolderOperations";
import {
  getMessageIdentityKey,
  getMessageListRowKeys,
} from "@/lib/message-identity";

interface MobileInboxLayoutProps {
  accounts: EmailAccount[];
}

type MobileView = "list" | "detail" | "folders";

export function MobileInboxLayout({ accounts }: MobileInboxLayoutProps) {
  const { selectedAccount } = useAppContext();
  const { clearSelection } = useMessageOperations();
  const {
    messages: filteredMessages,
    selectedMessage,
    isLoading,
    hasMore,
    isLoadingMore,
  } = useInboxState();
  const { selectMessage } = useMessageOperations();
  const { refreshMessages, loadMore } = useInbox();
  const {
    normalizedFolders,
    selectFolder: selectSharedFolder,
    selectedNav,
  } = useSharedFolderOperations();
  const { applyFilters } = useFilterOperations();
  const { searchLocal } = useInboxSearchOperations();

  const [currentView, setCurrentView] = React.useState<MobileView>("list");
  const [showFolders, setShowFolders] = React.useState(false);
  const [showCompose, setShowCompose] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [showSearch, setShowSearch] = React.useState(false);

  // When searching, filter messages locally; otherwise show all messages
  const displayMessages = searchTerm
    ? searchLocal(searchTerm)
    : filteredMessages;
  const displayMessageKeys = React.useMemo(
    () => getMessageListRowKeys(displayMessages),
    [displayMessages],
  );
  const fallbackInboxCount = filteredMessages.length;

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

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSelectMessage = async (mail: EmailMessage) => {
    await selectMessage(mail);
    setCurrentView("detail");
  };

  const handleBackToList = () => {
    setCurrentView("list");
    clearSelection();
  };

  const handleFolderSelect = async (folderPath: string, folderName: string) => {
    setShowFolders(false);
    void folderName;
    selectSharedFolder(folderPath);
  };

  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target?.isIntersecting && hasMore && !isLoadingMore) {
          void loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "100px" },
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

  const getFromDisplay = (mail: EmailMessage): string => {
    if (mail.name) return mail.name;
    if (mail.email) return mail.email;
    if (mail.from) return mail.from;
    return "Unknown";
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        {currentView === "detail" ? (
          <>
            <button
              onClick={handleBackToList}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-5 w-5" />
              Back
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refreshMessages()}
                disabled={isLoading}
                className="rounded-full p-2 hover:bg-muted">
                <EmailRefreshIcon
                  className={cn("h-5 w-5", isLoading && "animate-spin")}
                />
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => setShowFolders(!showFolders)}
              className="flex items-center gap-2 text-sm font-medium">
              <Menu className="h-5 w-5" />
              <span className="capitalize">{selectedNav || "Inbox"}</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="rounded-full p-2 hover:bg-muted">
                <Search className="h-5 w-5" />
              </button>
              <button
                onClick={() => refreshMessages()}
                disabled={isLoading}
                className="rounded-full p-2 hover:bg-muted">
                <EmailRefreshIcon
                  className={cn("h-5 w-5", isLoading && "animate-spin")}
                />
              </button>
            </div>
          </>
        )}
      </header>

      <ConnectionErrorBanner />

      {/* Search Bar (collapsible) */}
      {showSearch && currentView === "list" && (
        <div className="border-b border-border bg-card px-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input autoComplete="off"
              type="text"
              placeholder="Search emails..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {currentView === "list" && (
        <div className="flex border-b border-border bg-card">
          <button
            onClick={() => applyFilters({ readStatus: "all" })}
            className="flex-1 py-3 text-center text-sm font-medium text-muted-foreground hover:text-foreground">
            All
          </button>
          <button
            onClick={() => applyFilters({ readStatus: "unread" })}
            className="flex-1 py-3 text-center text-sm font-medium text-muted-foreground hover:text-foreground">
            Unread
          </button>
        </div>
      )}

      {/* Folder Drawer (bottom Sheet) */}
      <Sheet open={showFolders} onOpenChange={setShowFolders}>
        <SheetContent
          side="bottom"
          className="max-h-[70vh] overflow-y-auto rounded-t-2xl p-0">
          <SheetHeader className="sticky top-0 border-b border-border bg-card p-4">
            <SheetTitle className="text-left text-lg font-semibold">
              Folders
            </SheetTitle>
          </SheetHeader>
          <div className="p-2">
            {deduplicatedFolders.length === 0 ? (
              <button
                onClick={() => handleFolderSelect("INBOX", "Inbox")}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left",
                  selectedNav === "Inbox"
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted",
                )}>
                <Inbox className="h-5 w-5" />
                <span className="flex-1">Inbox</span>
                <span className="text-sm text-muted-foreground">
                  {fallbackInboxCount}
                </span>
              </button>
            ) : (
              deduplicatedFolders.map((folder) => {
                const FolderIcon = getFolderIcon(folder.name);
                const count = folder.count ?? 0;

                return (
                  <button
                    key={folder.path}
                    onClick={() => handleFolderSelect(folder.path, folder.name)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left",
                      selectedNav === folder.name
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted",
                    )}>
                    <FolderIcon className="h-5 w-5" />
                    <span className="flex-1">{folder.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {count}
                    </span>
                  </button>
                );
              })
            )}
            <TagFilterSection
              className="mt-2 border-t pt-2"
              onAfterToggle={() => setShowFolders(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {currentView === "list" ? (
          <div className="h-full overflow-y-auto">
            {isLoading && displayMessages.length === 0 ? (
              <MailListSkeleton count={10} />
            ) : (
              <>
                <div className="divide-y divide-border">
                  {displayMessages.map((mail, index) => {
                    const id = getMessageIdentityKey(mail);
                    return (
                      <SwipeActions
                        key={displayMessageKeys[index] ?? id}
                        mail={mail}
                        // Legacy fallback layout has no swipe handlers wired,
                        // so keep the archive/delete affordances off rather
                        // than promising an action that never runs.
                        disabled>
                        <button
                          onClick={() => handleSelectMessage(mail)}
                          className={cn(
                            "flex w-full flex-col gap-1 p-4 text-left transition-colors",
                            getMessageIdentityKey(selectedMessage) === id
                              ? "bg-primary/5"
                              : "hover:bg-muted/50",
                          )}>
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={cn(
                                "text-sm",
                                !mail.read && "font-semibold",
                              )}>
                              {getFromDisplay(mail)}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {mail.date
                                ? new Date(mail.date).toLocaleDateString()
                                : ""}
                            </span>
                          </div>
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span
                              className={cn(
                                "min-w-0 truncate text-sm",
                                !mail.read
                                  ? "font-medium text-foreground"
                                  : "text-muted-foreground",
                              )}>
                              {mail.subject || "(No subject)"}
                            </span>
                            <EmailTagBadges
                              tags={mail.tags}
                              maxVisible={2}
                              onTagClick={(tag) =>
                                applyFilters({ tags: [String(tag.id)] })
                              }
                            />
                          </div>
                          {mail.snippet && (
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              {mail.snippet}
                            </span>
                          )}
                        </button>
                      </SwipeActions>
                    );
                  })}
                </div>
                {isLoadingMore && <MailListSkeleton count={3} />}
                <div
                  ref={loadMoreRef}
                  className="flex h-20 items-center justify-center">
                  {!hasMore && displayMessages.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      No more emails
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <MailDisplay mail={selectedMessage} />
          </div>
        )}
      </div>

      {/* Floating Compose Button */}
      {currentView === "list" && (
        <button
          onClick={() => setShowCompose(true)}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90">
          <EmailComposeNewIcon className="h-6 w-6" />
        </button>
      )}

      {/* Compose Sheet */}
      <MobileComposeSheet
        isOpen={showCompose}
        onClose={() => setShowCompose(false)}
      />
    </div>
  );
}
