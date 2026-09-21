import { Fragment, memo, useCallback } from "react";
import { __, sprintf } from "@wordpress/i18n";
import { Star, Tag } from "lucide-react";

import { cn } from "@/lib/utils";
import { parseEmailDate } from "@/lib/email-date";
import { parseSenderName, parseSenderEmail } from "@/lib/mail-utils";
import {
  getMessageIdentityKey,
  getMessageListRowKeys,
} from "@/lib/message-identity";
import { InboxEmptyState } from "@/components/inbox/InboxEmptyState";

/**
 * Format timestamp contextually:
 * - Today: show time only "3:42 PM"
 * - This week: show day "Mon"
 * - Older: show date "Jan 5"
 */
function formatSmartTimestamp(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = today.getTime() - dateDay.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}

import {
  useFilterOperations,
  useInbox,
  useInboxState,
  useMessageOperations,
} from "@/context/InboxContext";
import { useComposer } from "@/context/composer";
import type { EmailMessage, EmailMessageTag } from "@/types";
import { InlineTagSelector } from "@/components/tags/TagSelector";

import { decodeMimeWords } from "./mail-display";
import { areMessageRowsEqual } from "./mail-list-item-equal";
import { MailListSkeleton } from "./mail-list-skeleton";
import { useMessageGridNavigation } from "./use-message-grid-navigation";
import { SelectionCheckbox } from "./SelectionCheckbox";
import { EmailRow } from "./EmailRow";
import { EmailListStatusSlots } from "./EmailListStatusSlots";
import { groupMessagesForDisplay } from "@/lib/message-grouping";
import { getEffectiveEmailListGrouping } from "@/lib/effective-email-list-grouping";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import {
  emailListDateGroupKey,
  getEmailListRowPresentation,
} from "@/lib/preference-behavior";
import { useEmailMessageTagActions } from "@/hooks/useEmailMessageTagActions";
import {
  useDraggableEmail,
  useDragDropContext,
} from "@/components/shared/drag-drop";
import { useFeatureEnabled } from "@/context/features";
import {
  useMailOperations,
  type MailOperationResult,
} from "@/layouts/shared/hooks/useMailOperations";
import { isImportantActionAvailable } from "@/lib/inbox-action-visibility";

import { Badge, toast } from "@kit/ui/plugin";
interface MailListProps {
  items?: EmailMessage[];
  /** Whether selection checkboxes are enabled */
  enableSelection?: boolean;
  /** Whether to show sender email and preview details under the main rows */
  showDetails?: boolean;
}

/**
 * Get a fill color for a tag based on its name.
 */
function getTagFillColor(tag: string): string {
  const colors = [
    "#3b82f6", // blue-500
    "#22c55e", // green-500
    "#f59e0b", // amber-500
    "#a855f7", // purple-500
    "#f43f5e", // rose-500
    "#06b6d4", // cyan-500
    "#f97316", // orange-500
  ];
  const hash = tag.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length] || "currentColor";
}

/**
 * Compact tag indicator showing a tag icon filled with the first tag's color.
 * Full tag list shown in tooltip on hover.
 */
function TagIndicator({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;

  const firstTag = tags[0];
  const remainingCount = tags.length - 1;
  const fillColor = getTagFillColor(firstTag || "");

  return (
    <div className="flex items-center gap-0.5 shrink-0" title={tags.join(", ")}>
      <Tag className="h-3 w-3" style={{ color: fillColor }} fill={fillColor} />
      <span className="max-w-20 truncate">{firstTag}</span>
      {remainingCount > 0 && (
        <span className="text-[10px] text-muted-foreground">
          +{remainingCount}
        </span>
      )}
    </div>
  );
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

/**
 * Row count from which offscreen rows stop being laid out.
 *
 * Below this the browser's layout work is not the problem and the extra style
 * is one more thing to reason about. At and above it, the list is long enough
 * that skipping offscreen rows is the difference between a scroll that keeps up
 * and one that does not. The mobile list uses the same threshold.
 */
const DEFERRED_PAINT_ROWS = 200;

interface MailListItemProps {
  item: EmailMessage;
  index: number;
  /**
   * Whether this row is the open message. Passed as the rendered boolean, not a
   * key to compare: the row id is a bare IMAP UID while the selection key is the
   * full mailbox identity tuple, so comparing the two inside the memo
   * comparator was always false and a selection change never re-rendered a row.
   */
  selected: boolean;
  /** Roving tabindex from the list grid: 0 for the tab stop, -1 for the rest. */
  rowTabIndex: number;
  enableSelection: boolean;
  onSelect: (item: EmailMessage) => void;
  onStarClick: (e: React.MouseEvent, messageId: string) => void;
  /**
   * Absent when the build cannot persist importance, which leaves the chevron
   * a static marker rather than a control that would 404.
   */
  onImportantClick?: (e: React.MouseEvent, message: EmailMessage) => void;
  showDetails: boolean;
  density: "loose" | "comfortable" | "compact" | "dense";
  showPreview: boolean;
  showAccountBadge: boolean;
  showAttachmentIcon: boolean;
  unreadIndicator: "dot_and_bold" | "dot" | "bold";
  tagAccountId?: number;
  currentFolder?: string;
  onTagClick: (tag: EmailMessageTag) => void;
  onTagRemove: (message: EmailMessage, tag: EmailMessageTag) => void;
  /** Count displayed only on the newest row in a conversation. */
  threadCount?: number;
  threadGrouped?: boolean;
  /**
   * Let the browser skip layout and paint for offscreen rows. Set once the list
   * is long enough that the browser's own work is the cost, not the network or
   * the cache.
   */
  deferredPaint?: boolean;
}

function resolveTagAccountId(
  item: EmailMessage,
  fallbackAccountId?: string | number | null,
): number | undefined {
  const rawAccountId = item.accountId ?? fallbackAccountId;
  const accountId = Number(rawAccountId);
  return Number.isInteger(accountId) && accountId > 0 ? accountId : undefined;
}

/**
 * Individual email card with drag handle on sender name.
 * Memoized with a row-field comparator so sibling changes (e.g., a star
 * toggle on another row) do not force this row to re-render.
 */
const MailListItem = memo(
  function MailListItem({
    item,
    index,
    selected,
    rowTabIndex,
    enableSelection,
    onSelect,
    onStarClick,
    onImportantClick,
    showDetails,
    density,
    showPreview,
    showAccountBadge,
    showAttachmentIcon,
    unreadIndicator,
    tagAccountId,
    currentFolder,
    onTagClick,
    onTagRemove,
    threadCount,
    threadGrouped,
    deferredPaint,
  }: MailListItemProps) {
    const { rowRef, handleListeners, handleAttributes, isDragging, rowStyle } =
      useDraggableEmail({ message: item });

    // Check if this row is part of a multi-select drag
    const { draggedMessageIds } = useDragDropContext();
    const isPartOfDrag =
      !isDragging &&
      draggedMessageIds.length > 0 &&
      draggedMessageIds.includes(getMessageIdentityKey(item));

    const senderName = parseSenderName(item);
    // Ensure labels is always an array before calling filter
    const safeLabels = Array.isArray(item.labels) ? item.labels : [];

    // Log problematic label data for debugging (can be removed in production)
    if (
      !Array.isArray(item.labels) &&
      item.labels !== undefined &&
      item.labels !== null
    ) {
      console.warn("[MailList] Non-array labels detected:", {
        messageId: item.id,
        labels: item.labels,
        labelType: typeof item.labels,
      });
    }

    const displayLabels = safeLabels.filter(
      (label) =>
        label &&
        typeof label === "string" &&
        !FOLDER_NAMES.includes(label.toLowerCase()),
    );
    const receivedDate = parseEmailDate(item.receivedDate ?? item.date);
    const messageKey = getMessageIdentityKey(item);

    return (
      <EmailRow
        message={item}
        variant="default-flat"
        density={density}
        testId="message-item"
        selected={selected}
        tabIndex={rowTabIndex}
        enableSelection={enableSelection}
        showAccountBadge={showAccountBadge && Boolean(item.accountEmail)}
        showSenderEmail={showDetails}
        showPreview={showPreview}
        showAttachmentIcon={showAttachmentIcon}
        unreadIndicator={unreadIndicator}
        rowRef={rowRef}
        rowStyle={rowStyle}
        isDragging={isDragging}
        isPartOfDrag={isPartOfDrag}
        threadGrouped={threadGrouped}
        deferredPaint={deferredPaint}
        dragHandleProps={{
          ...handleListeners,
          ...handleAttributes,
          title: `${senderName}${
            item.email || item.from ? ` - ${parseSenderEmail(item)}` : ""
          }`,
        }}
        selectionSlot={
          enableSelection ? (
            <SelectionCheckbox messageId={messageKey} message={item} />
          ) : null
        }
        rightRailSlot={
          <EmailListStatusSlots message={item} threadCount={threadCount} />
        }
        showHoverActions={Boolean(tagAccountId)}
        extraHoverActionsSlot={
          tagAccountId ? (
            <InlineTagSelector
              accountId={tagAccountId}
              messageUid={String(item.uid ?? "")}
              uidValidity={String(item.uidValidity ?? "")}
              folder={item.folder ?? ""}
              messageTags={item.tags}
            />
          ) : null
        }
        actions={{
          // The mutation identity is the mailbox tuple, never the row id: the
          // server sends the bare IMAP UID as `id`, which no operation can
          // resolve back to an account, folder and generation.
          onToggleStar: (message, event) =>
            onStarClick(event, getMessageIdentityKey(message)),
          onToggleImportant: onImportantClick
            ? (message, event) => onImportantClick(event, message)
            : undefined,
        }}
        onTagClick={onTagClick}
        onTagRemove={(tag) => onTagRemove(item, tag)}
        onSelect={onSelect}
      />
    );
  },
  (prev, next) => {
    return (
      areMessageRowsEqual(prev.item, next.item) &&
      prev.enableSelection === next.enableSelection &&
      prev.selected === next.selected &&
      prev.rowTabIndex === next.rowTabIndex &&
      prev.index === next.index &&
      prev.onSelect === next.onSelect &&
      prev.onStarClick === next.onStarClick &&
      prev.onImportantClick === next.onImportantClick &&
      prev.showDetails === next.showDetails &&
      prev.density === next.density &&
      prev.showPreview === next.showPreview &&
      prev.showAccountBadge === next.showAccountBadge &&
      prev.showAttachmentIcon === next.showAttachmentIcon &&
      prev.unreadIndicator === next.unreadIndicator &&
      prev.tagAccountId === next.tagAccountId &&
      prev.currentFolder === next.currentFolder &&
      prev.onTagClick === next.onTagClick &&
      prev.onTagRemove === next.onTagRemove &&
      prev.threadCount === next.threadCount &&
      prev.threadGrouped === next.threadGrouped &&
      prev.deferredPaint === next.deferredPaint
    );
  },
);

export function MailList({
  items,
  enableSelection = true,
  showDetails = false,
}: MailListProps) {
  const {
    messages: filteredMessages,
    selectedMessage,
    isLoading,
    error,
    retryInit,
  } = useInboxState();
  const { selectedAccountId, selectedFolder, threadGroups } = useInbox();
  const { activeFilters } = useFilterOperations();
  const { selectMessage, toggleStar } = useMessageOperations();
  const { requestNavigation } = useComposer();
  const { preferences } = useUserPreferences();
  const { filterByTag, removeMessageTag } = useEmailMessageTagActions();
  const { toggleImportant } = useMailOperations();
  // Importance is persisted by the Pro smart-inbox route only, so Free renders
  // the marker without the control rather than a button that always 404s.
  const importantAvailable = isImportantActionAvailable({
    isFreeBuild: __IS_FREE__,
    smartInboxEnabled: useFeatureEnabled("smart_inbox"),
  });

  const handleStarClick = useCallback(
    (e: React.MouseEvent, messageId: string) => {
      e.stopPropagation();
      void toggleStar(messageId);
    },
    [toggleStar],
  );

  const runRowOperation = useCallback(
    async (
      operation: () => Promise<MailOperationResult>,
      fallbackMessage: string,
    ): Promise<void> => {
      try {
        const result = await operation();
        if (!result.success) {
          toast.error(result.error || fallbackMessage);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : fallbackMessage);
      }
    },
    [],
  );

  const handleImportantClick = useCallback(
    (e: React.MouseEvent, message: EmailMessage) => {
      e.stopPropagation();
      void runRowOperation(
        () => toggleImportant(message),
        __("Failed to update importance", "pressedmail"),
      );
    },
    [runRowOperation, toggleImportant],
  );

  const guardedSelect = useCallback(
    (msg: EmailMessage) => {
      requestNavigation(() => {
        void selectMessage(msg);
      });
    },
    [requestNavigation, selectMessage],
  );

  const handleTagRemove = useCallback(
    (message: EmailMessage, tag: EmailMessageTag) => {
      void removeMessageTag(message, tag, {
        accountId: resolveTagAccountId(message, selectedAccountId),
        folder: message.folder ?? selectedFolder,
      });
    },
    [removeMessageTag, selectedAccountId, selectedFolder],
  );

  // Use provided items or fall back to filtered messages from context, then
  // apply the List/Threads grouping mode.
  const sourceMessages = items || filteredMessages || [];
  const grouping = groupMessagesForDisplay(
    sourceMessages,
    getEffectiveEmailListGrouping(preferences.email_list_grouping ?? "list"),
    threadGroups,
  );
  const messagesToDisplay = grouping.items;
  const messageRowKeys = getMessageListRowKeys(messagesToDisplay);
  const selectedMessageKey = getMessageIdentityKey(selectedMessage);
  // A search that matched nothing is not an empty folder. The term is already
  // in the active filters, so every list can say which search came back empty.
  const searchTerm = activeFilters?.searchTerm?.trim() || undefined;
  const rowPresentation = getEmailListRowPresentation(preferences);
  const density = rowPresentation.density;
  const showPreview = rowPresentation.showPreview;
  const showAccountBadge = rowPresentation.showAccountBadge;
  const showAttachmentIcon = rowPresentation.showAttachmentIcon;
  const unreadIndicator = rowPresentation.unreadIndicator;
  const dateGrouping = rowPresentation.dateGrouping;
  const { gridProps, getRowTabIndex } =
    useMessageGridNavigation<HTMLDivElement>(messagesToDisplay.length);

  if (messagesToDisplay.length <= 0 && isLoading) {
    return <MailListSkeleton count={10} />;
  }

  // Three lists said "could not load" in three slightly different ways, and
  // only one of them said anything true about the folder. One shared state
  // now, so every layout reports the same failure with the same retry.
  if (error && messagesToDisplay.length === 0) {
    return (
      <InboxEmptyState
        folder={selectedFolder}
        variant="error"
        error={error}
        onRetry={retryInit}
      />
    );
  }

  if (!messagesToDisplay.length) {
    return (
      <InboxEmptyState
        folder={selectedFolder}
        variant={searchTerm ? "search" : "empty"}
        searchTerm={searchTerm}
      />
    );
  }

  return (
    <div
      {...gridProps}
      role="grid"
      aria-label={__("Messages", "pressedmail")}
      className="flex flex-col"
      data-test="message-list">
      {messagesToDisplay.map((item: EmailMessage, index: number) => {
        const itemKey = getMessageIdentityKey(item);
        const threadMeta = grouping.meta.get(itemKey);
        const groupKey = emailListDateGroupKey(
          item.receivedDate ?? item.date,
          dateGrouping,
        );
        const previous = messagesToDisplay[index - 1];
        const previousKey = previous
          ? emailListDateGroupKey(
              previous.receivedDate ?? previous.date,
              dateGrouping,
            )
          : null;
        const showGroup = Boolean(groupKey) && groupKey !== previousKey;
        return (
          <Fragment key={messageRowKeys[index] ?? itemKey}>
            {showGroup ? (
              // Every child of a grid has to be a row, date separators included.
              <div role="row">
                <div
                  role="gridcell"
                  className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  data-test="email-list-date-group">
                  {groupKey}
                </div>
              </div>
            ) : null}
            <MailListItem
              item={item}
              index={index}
              // A row with no mailbox identity (a virtual Snoozed row, say) has
              // an empty key, which must never match the empty key of "nothing
              // selected", or every such row renders as the open message.
              selected={Boolean(itemKey) && itemKey === selectedMessageKey}
              rowTabIndex={getRowTabIndex(index)}
              enableSelection={enableSelection}
              onSelect={guardedSelect}
              onStarClick={handleStarClick}
              onImportantClick={
                importantAvailable ? handleImportantClick : undefined
              }
              showDetails={showDetails}
              density={density}
              showPreview={showPreview}
              showAccountBadge={showAccountBadge}
              showAttachmentIcon={showAttachmentIcon}
              unreadIndicator={unreadIndicator}
              tagAccountId={resolveTagAccountId(item, selectedAccountId)}
              currentFolder={selectedFolder}
              onTagClick={filterByTag}
              onTagRemove={handleTagRemove}
              threadCount={threadMeta?.isNewest ? threadMeta.count : undefined}
              threadGrouped={threadMeta?.isThreaded}
              deferredPaint={messagesToDisplay.length > DEFERRED_PAINT_ROWS}
            />
          </Fragment>
        );
      })}
    </div>
  );
}
