import React, {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { __ } from "@wordpress/i18n";
import { AlertCircle, Bookmark, Clock, FolderInput, Star } from "lucide-react";
import {
  EmailArchiveIcon,
  EmailForwardIcon,
  EmailMarkUnreadIcon,
  EmailReplyIcon,
  EmailTrashIcon,
} from "@/components/icons/MailActionIcons";

import { cn } from "@/lib/utils";
import { formatEmailRelativeTime } from "@/lib/email-date";
import { parseSenderEmail, parseSenderName } from "@/lib/mail-utils";
import {
  getMessageIdentityKey,
  getMessageListRowKeys,
} from "@/lib/message-identity";
import { getMessageFilterSignature } from "@/lib/message-filter-signature";
import {
  DEFAULT_EMAIL_LIST_SORT,
  sortEmailMessages,
  type EmailListSortState,
} from "@/lib/email-list-sort";
import {
  useInboxState,
  useInbox,
  useFilterOperations,
  useMessageOperations,
  useFolderOperations,
} from "@/context/InboxContext";
import { useMailOperations } from "@/layouts/shared/hooks/useMailOperations";
import type { EmailMessage, EmailMessageTag } from "@/types";
import { SnoozePopover } from "@/components/snooze/snooze-popover";
import { SelectionCheckbox } from "@/components/inbox/SelectionCheckbox";
import { EmailRow } from "@/components/inbox/EmailRow";
import { EmailListStatusSlots } from "@/components/inbox/EmailListStatusSlots";
import { InboxEmptyState } from "@/components/inbox/InboxEmptyState";
import { InlineTagSelector } from "@/components/tags/TagSelector";
import { groupMessagesForDisplay } from "@/lib/message-grouping";
import { getEffectiveEmailListGrouping } from "@/lib/effective-email-list-grouping";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import {
  emailListDateGroupKey,
  getEmailListRowPresentation,
} from "@/lib/preference-behavior";
import { useEmailMessageTagActions } from "@/hooks/useEmailMessageTagActions";

import { decodeMimeWords } from "./mail-display";
import { areMessageRowsEqual } from "./mail-list-item-equal";
import { MailListSkeleton } from "./mail-list-skeleton";
import { PaginationBar } from "@/layouts/variants/default/inbox/PaginationBar";
import {
  useDraggableEmail,
  useDragDropContext,
} from "@/components/shared/drag-drop";

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ScrollArea,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kit/ui/plugin";
import { folderMutationTarget, folderTargetKey } from "@/lib/folder-target";

export interface MailListItemActions {
  onToggleStar?: (message: EmailMessage) => void;
  onToggleImportant?: (message: EmailMessage) => void;
  onArchive?: (message: EmailMessage) => void;
  onDelete?: (message: EmailMessage) => void;
  onToggleRead?: (message: EmailMessage) => void;
  onSnooze?: (message: EmailMessage) => void;
  onReply?: (message: EmailMessage) => void;
  onReplyAll?: (message: EmailMessage) => void;
  onForward?: (message: EmailMessage) => void;
}

/**
 * Per-row "Move to folder" control shown in the hover action menu. Mounts only
 * when its row is hovered (it lives inside the hover slot), so its context hooks
 * run for the hovered row only.
 */
export function MoveToFolderMenu({ message }: { message: EmailMessage }) {
  const { getMoveTargetFolders } = useFolderOperations();
  const { moveToFolder } = useMailOperations();
  const moveTargets = getMoveTargetFolders();

  if (moveTargets.length === 0) return null;

  const messageId = String(message.uid ?? message.id);

  return (
    // Non-modal: a modal dropdown locks body pointer events, so the email card
    // loses :hover and the hover-reveal action bar (with this trigger) hides,
    // flash-closing the menu. The Tags/Snooze popovers are non-modal and work.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title={__("Move to folder", "pressedmail")}
          aria-label={__("Move to folder", "pressedmail")}
          onClick={(event) => event.stopPropagation()}>
          <FolderInput className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(event) => event.stopPropagation()}>
        {moveTargets.map((folder) => (
          <DropdownMenuItem
            key={folderTargetKey(folder)}
            onClick={() =>
              void moveToFolder([messageId], folderMutationTarget(folder))
            }>
            {folder.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface MailListPaginatedProps {
  pageSize?: 20 | 50 | 100;
  actions?: MailListItemActions;
  accountId?: number;
  enableSelection?: boolean;
  showDetails?: boolean;
  hideColumnHeader?: boolean;
  sort?: EmailListSortState;
}

function getBadgeVariantFromLabel(
  label: string,
): ComponentProps<typeof Badge>["variant"] {
  if (["work"].includes(label.toLowerCase())) {
    return "default";
  }
  if (["personal"].includes(label.toLowerCase())) {
    return "outline";
  }
  return "secondary";
}

// Folder name labels to filter out
const FOLDER_NAMES = [
  "inbox",
  "sent",
  "drafts",
  "trash",
  "spam",
  "junk",
  "archive",
  "all mail",
  "starred",
  "important",
];

function resolveTagAccountId(
  item: EmailMessage,
  fallbackAccountId?: string | number | null,
): number | undefined {
  const rawAccountId = item.accountId ?? fallbackAccountId;
  const accountId = Number(rawAccountId);
  return Number.isInteger(accountId) && accountId > 0 ? accountId : undefined;
}

export function MailListPaginated({
  pageSize: propPageSize = 50,
  actions,
  accountId,
  enableSelection,
  showDetails = false,
  hideColumnHeader = false,
  sort = DEFAULT_EMAIL_LIST_SORT,
}: MailListPaginatedProps) {
  const {
    messages: filteredMessages,
    selectedMessage,
    isLoading,
    isLoadingMore,
    error,
    retryInit,
    totalCount,
    hasMore,
  } = useInboxState();
  const { selectMessage } = useMessageOperations();
  const { activeFilters } = useFilterOperations();
  const { loadPage, selectedAccountId, selectedFolder, threadGroups } =
    useInbox();
  const { preferences } = useUserPreferences();
  const { filterByTag, removeMessageTag } = useEmailMessageTagActions();

  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const loadPageRef = useRef(loadPage);
  const filterSignature = useMemo(
    () => getMessageFilterSignature(activeFilters),
    [activeFilters],
  );

  useEffect(() => {
    loadPageRef.current = loadPage;
  }, [loadPage]);

  const messagesToDisplay = useMemo(
    () => sortEmailMessages(filteredMessages || [], sort),
    [filteredMessages, sort],
  );

  // Calculate pagination using server total when available so buttons enable
  // for pages beyond what's loaded client-side.
  const loadedCount = messagesToDisplay.length;
  const effectiveTotal =
    typeof totalCount === "number" && totalCount > loadedCount
      ? totalCount
      : loadedCount;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / propPageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  // Apply the List/Threads grouping mode to the loaded page of messages.
  const grouping = useMemo(
    () =>
      groupMessagesForDisplay(
        messagesToDisplay,
        getEffectiveEmailListGrouping(
          preferences.email_list_grouping ?? "list",
        ),
        threadGroups,
      ),
    [messagesToDisplay, preferences.email_list_grouping, threadGroups],
  );
  const currentMessages = grouping.items;
  const currentMessageKeys = useMemo(
    () => getMessageListRowKeys(currentMessages),
    [currentMessages],
  );
  const selectedMessageKey = getMessageIdentityKey(selectedMessage);
  const rowPresentation = getEmailListRowPresentation(preferences);

  useEffect(() => {
    if (!selectedAccountId) {
      return;
    }

    setCurrentPage(1);
    void loadPageRef.current(1, propPageSize);
  }, [
    filterSignature,
    preferences.email_list_grouping,
    propPageSize,
    selectedAccountId,
    selectedFolder,
  ]);

  // A mass removal (sweep, bulk move) can shrink the total below the current
  // page. safeCurrentPage only clamps the DISPLAY, actually re-load the last
  // valid page so the user isn't stranded on an empty page.
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
      void loadPageRef.current(totalPages, propPageSize);
    }
  }, [currentPage, totalPages, propPageSize]);

  const serverHasMore = safeCurrentPage * propPageSize < effectiveTotal;

  const handlePageChange = useCallback(
    async (page: number) => {
      setCurrentPage(page);
      void loadPage(page, propPageSize);
    },
    [loadPage, propPageSize],
  );

  const handleTagRemove = useCallback(
    (message: EmailMessage, tag: EmailMessageTag) => {
      void removeMessageTag(message, tag, {
        accountId: resolveTagAccountId(message, accountId ?? selectedAccountId),
        folder: message.folder ?? selectedFolder,
      });
    },
    [accountId, removeMessageTag, selectedAccountId, selectedFolder],
  );

  if (messagesToDisplay.length <= 0 && isLoading) {
    return <MailListSkeleton count={10} />;
  }

  if (error && messagesToDisplay.length === 0) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
        data-test="inbox-error">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <h3 className="font-medium text-sm">
            {__("Failed to load messages", "pressedmail")}
          </h3>
          <p className="text-xs text-muted-foreground max-w-[200px]">
            {__(
              "Could not connect to mail server. Check your connection and try again.",
              "pressedmail",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={retryInit}
          className="mt-2 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          {__("Retry", "pressedmail")}
        </button>
      </div>
    );
  }

  if (!messagesToDisplay.length) {
    return (
      <div className="flex h-full flex-col" data-test="inbox-empty-paginated">
        <InboxEmptyState />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Table with scrollable body */}
      <ScrollArea className="flex-1 min-h-0">
        <Table>
          {!hideColumnHeader && (
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                {enableSelection && (
                  <TableHead className="w-10 pl-3"></TableHead>
                )}
                <TableHead
                  className={cn("pl-4", actions ? "w-14" : "w-8")}></TableHead>
                <TableHead className="w-44">
                  {__("From", "pressedmail")}
                </TableHead>
                <TableHead colSpan={2} className="pr-4">
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <span>{__("Subject & Preview", "pressedmail")}</span>
                    <span className="text-right">
                      {__("Date", "pressedmail")}
                    </span>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
          )}
          <TableBody>
            {currentMessages.map((item: EmailMessage, index) => {
              const itemKey = getMessageIdentityKey(item);
              const threadMeta = grouping.meta.get(itemKey);
              const groupKey = emailListDateGroupKey(
                item.receivedDate ?? item.date,
                rowPresentation.dateGrouping,
              );
              const previous = currentMessages[index - 1];
              const previousKey = previous
                ? emailListDateGroupKey(
                    previous.receivedDate ?? previous.date,
                    rowPresentation.dateGrouping,
                  )
                : null;
              const showGroup = Boolean(groupKey) && groupKey !== previousKey;
              return (
                <React.Fragment key={currentMessageKeys[index] ?? itemKey}>
                  {showGroup ? (
                    <TableRow data-test="email-list-date-group">
                      <TableCell
                        colSpan={enableSelection ? 4 : 3}
                        className="bg-muted/40 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {groupKey}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  <MailListPaginatedRow
                    item={item}
                    selectedMessageId={selectedMessageKey}
                    enableSelection={enableSelection}
                    actions={actions}
                    accountId={accountId}
                    showDetails={showDetails}
                    isHovered={hoveredRowId === itemKey}
                    onHover={setHoveredRowId}
                    onSelect={selectMessage}
                    onTagClick={filterByTag}
                    onTagRemove={handleTagRemove}
                    threadCount={
                      threadMeta?.isNewest ? threadMeta.count : undefined
                    }
                    threadGrouped={threadMeta?.isThreaded}
                    density={rowPresentation.density}
                    showPreview={rowPresentation.showPreview}
                    showAccountBadge={rowPresentation.showAccountBadge}
                    showAttachmentIcon={rowPresentation.showAttachmentIcon}
                    unreadIndicator={rowPresentation.unreadIndicator}
                  />
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Pagination footer, relative z-10 ensures it sits above ScrollArea content
           and prevents click-through to table rows underneath */}
      <PaginationBar
        className="relative z-10"
        currentPage={safeCurrentPage}
        totalItems={effectiveTotal}
        pageSize={propPageSize}
        onPageChange={handlePageChange}
        serverTotalItems={totalCount}
        hasMore={serverHasMore}
      />
    </div>
  );
}

interface MailListPaginatedRowProps {
  item: EmailMessage;
  selectedMessageId?: string;
  enableSelection?: boolean;
  actions?: MailListItemActions;
  accountId?: number;
  showDetails?: boolean;
  isHovered?: boolean;
  onHover?: React.Dispatch<React.SetStateAction<string | null>>;
  onSelect: (message: EmailMessage) => void;
  onTagClick: (tag: EmailMessageTag) => void;
  onTagRemove: (message: EmailMessage, tag: EmailMessageTag) => void;
  /** Count displayed only on the newest row in a conversation. */
  threadCount?: number;
  threadGrouped?: boolean;
  density: ReturnType<typeof getEmailListRowPresentation>["density"];
  showPreview: boolean;
  showAccountBadge: boolean;
  showAttachmentIcon: boolean;
  unreadIndicator: ReturnType<
    typeof getEmailListRowPresentation
  >["unreadIndicator"];
}

const MailListPaginatedRow = React.memo(
  function MailListPaginatedRow({
    item,
    selectedMessageId,
    enableSelection,
    actions,
    accountId,
    showDetails,
    isHovered,
    onHover,
    onSelect,
    onTagClick,
    onTagRemove,
    threadCount,
    threadGrouped,
    density,
    showPreview,
    showAccountBadge,
    showAttachmentIcon,
    unreadIndicator,
  }: MailListPaginatedRowProps) {
    const { rowRef, handleListeners, handleAttributes, isDragging, rowStyle } =
      useDraggableEmail({ message: item });

    // Keep the hover-actions slot mounted while the snooze popover is open:
    // the popover portals to <body>, so moving the pointer to it fires the
    // row's mouseleave, which would unmount the popover mid-interaction.
    const [snoozeOpen, setSnoozeOpen] = React.useState(false);

    const { draggedMessageIds } = useDragDropContext();
    const isPartOfDrag =
      !isDragging &&
      draggedMessageIds.length > 0 &&
      draggedMessageIds.includes(getMessageIdentityKey(item));

    const senderName = parseSenderName(item);
    const safeLabels = Array.isArray(item.labels) ? item.labels : [];
    const displayLabels = safeLabels.filter(
      (label) =>
        label &&
        typeof label === "string" &&
        !FOLDER_NAMES.includes(label.toLowerCase()),
    );

    const messageKey = getMessageIdentityKey(item);
    const isSelected = selectedMessageId === messageKey;
    const tagAccountId = resolveTagAccountId(item, accountId);

    return (
      <EmailRow
        message={item}
        variant="pressedg-table"
        density={density}
        selected={isSelected}
        enableSelection={enableSelection}
        showAccountBadge={showAccountBadge && Boolean(item.accountEmail)}
        showSenderEmail={showDetails}
        showPreview={showPreview}
        showAttachmentIcon={showAttachmentIcon}
        unreadIndicator={unreadIndicator}
        showHoverActions={
          (Boolean(isHovered) || snoozeOpen) && Boolean(actions || tagAccountId)
        }
        rowRef={rowRef}
        rowStyle={rowStyle}
        isDragging={isDragging}
        isPartOfDrag={isPartOfDrag}
        threadGrouped={threadGrouped}
        dragHandleProps={{
          ...handleListeners,
          ...handleAttributes,
        }}
        selectionSlot={
          enableSelection ? <SelectionCheckbox messageId={messageKey} /> : null
        }
        rightRailSlot={
          <EmailListStatusSlots
            message={item}
            threadCount={threadCount}
            slotClassName="h-5 w-5"
            summaryClassName="h-5 w-5"
            phishingClassName="h-5"
          />
        }
        extraHoverActionsSlot={
          <>
            {actions?.onSnooze && tagAccountId ? (
              <SnoozePopover
                accountId={tagAccountId}
                messageUid={item.uid != null ? String(item.uid) : undefined}
                folder={item.folder}
                sourceUidValidity={item.uidValidity ?? item.uid_validity}
                sourceMessageId={item.messageId ?? item.message_id}
                subject={item.subject}
                from={item.from}
                date={item.receivedDate ?? item.date}
                onOpenChange={setSnoozeOpen}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="theme-action-button h-7 w-7 opacity-100"
                  title={__("Snooze", "pressedmail")}
                  aria-label={__("Snooze", "pressedmail")}
                  onClick={(e) => e.stopPropagation()}>
                  <Clock className="h-4 w-4" />
                </Button>
              </SnoozePopover>
            ) : null}
            {tagAccountId ? (
              <InlineTagSelector
                accountId={tagAccountId}
                messageUid={String(item.uid ?? item.id)}
                messageId={item.consolidatedUid ?? item.id}
                folder={item.folder ?? "INBOX"}
                messageTags={item.tags}
              />
            ) : null}
            <MoveToFolderMenu message={item} />
          </>
        }
        actions={actions}
        onTagClick={onTagClick}
        onTagRemove={(tag) => onTagRemove(item, tag)}
        onSelect={onSelect}
        onMouseEnter={() => onHover?.(messageKey)}
        onMouseLeave={() =>
          onHover?.((prev) => (prev === messageKey ? null : prev))
        }
        className={cn(isHovered && "bg-muted/30")}
      />
    );
  },
  (prev, next) => {
    return (
      areMessageRowsEqual(prev.item, next.item) &&
      prev.enableSelection === next.enableSelection &&
      (prev.selectedMessageId === prev.item.id) ===
        (next.selectedMessageId === next.item.id) &&
      prev.accountId === next.accountId &&
      prev.showDetails === next.showDetails &&
      prev.isHovered === next.isHovered &&
      prev.actions === next.actions &&
      prev.onSelect === next.onSelect &&
      prev.onHover === next.onHover &&
      prev.onTagClick === next.onTagClick &&
      prev.onTagRemove === next.onTagRemove &&
      prev.threadCount === next.threadCount &&
      prev.threadGrouped === next.threadGrouped &&
      prev.density === next.density &&
      prev.showPreview === next.showPreview &&
      prev.showAccountBadge === next.showAccountBadge &&
      prev.showAttachmentIcon === next.showAttachmentIcon &&
      prev.unreadIndicator === next.unreadIndicator
    );
  },
);
