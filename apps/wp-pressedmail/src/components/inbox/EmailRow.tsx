import * as React from "react";
import { __, sprintf } from "@wordpress/i18n";
import { Paperclip, Star } from "lucide-react";
import { ScheduledFolderIcon } from "@/components/icons/FolderIcons";

import { cn } from "@/lib/utils";
import type { EmailMessage, EmailMessageTag } from "@/types";
import { EmailTagBadges } from "@/components/tags/EmailTagBadges";
import {
  EmailArchiveIcon,
  EmailForwardIcon,
  EmailMarkUnreadIcon,
  EmailReplyAllIcon,
  EmailReplyIcon,
  EmailTrashIcon,
} from "@/components/icons/MailActionIcons";
import { EmailImportantMarker } from "./EmailImportantMarker";

import {
  buildEmailRowViewModel,
  type EmailRowDensity,
  type EmailRowVariant,
} from "./email-row-model";
import type { EmailListUnreadIndicator } from "@/hooks/useUserPreferences";

import { Badge, Button, TableCell, TableRow } from "@kit/ui/plugin";

export interface EmailRowActions {
  onToggleStar?: (message: EmailMessage, event: React.MouseEvent) => void;
  onToggleImportant?: (message: EmailMessage, event: React.MouseEvent) => void;
  onReply?: (message: EmailMessage) => void;
  onReplyAll?: (message: EmailMessage) => void;
  onForward?: (message: EmailMessage) => void;
  onArchive?: (message: EmailMessage) => void;
  onDelete?: (message: EmailMessage) => void;
  onToggleRead?: (message: EmailMessage) => void;
}

export interface EmailRowProps {
  message: EmailMessage;
  variant: EmailRowVariant;
  density?: EmailRowDensity;
  selected?: boolean;
  bulkSelected?: boolean;
  enableSelection?: boolean;
  showAccountBadge?: boolean;
  showSenderEmail?: boolean;
  showPreview?: boolean;
  showAttachmentIcon?: boolean;
  unreadIndicator?: EmailListUnreadIndicator;
  showHoverActions?: boolean;
  isDragging?: boolean;
  isPartOfDrag?: boolean;
  threadGrouped?: boolean;
  /**
   * Roving tabindex position supplied by the list grid: 0 for the row that
   * currently holds the grid's tab stop, -1 for the rest. Defaults to 0 so a
   * row rendered outside a managed grid stays reachable.
   */
  tabIndex?: number;
  /**
   * 1-based position of this row in the whole grid, column header included.
   * Only the lists that page or lazy-load set it: they declare an
   * aria-rowcount covering rows that are not in the DOM, and aria-rowindex is
   * what makes that count mean anything to a screen reader.
   */
  rowIndex?: number;
  rowRef?: React.Ref<HTMLElement>;
  rowStyle?: React.CSSProperties;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  selectionSlot?: React.ReactNode;
  rightRailSlot?: React.ReactNode;
  hoverActionsSlot?: React.ReactNode;
  extraHoverActionsSlot?: React.ReactNode;
  actions?: EmailRowActions;
  onTagClick?: (
    tag: EmailMessageTag,
    event: React.SyntheticEvent<HTMLElement>,
  ) => void;
  onTagRemove?: (
    tag: EmailMessageTag,
    event: React.SyntheticEvent<HTMLElement>,
  ) => void;
  className?: string;
  testId?: string;
  onSelect?: (message: EmailMessage) => void;
  onMouseEnter?: React.MouseEventHandler<HTMLElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLElement>;
}

function stopPropagation(event: React.MouseEvent) {
  event.stopPropagation();
}

/**
 * dnd-kit hands a drag handle its own keyboard affordances (role, tabindex and
 * pick-up instructions). The email drag context registers a PointerSensor only,
 * so those attributes promise a keyboard drag that cannot happen and leave a
 * dead tab stop on the sender of every row. Drop them and keep the pointer
 * listeners. Restore them the day a KeyboardSensor is registered.
 */
function pointerOnlyDragProps(
  props: React.HTMLAttributes<HTMLElement> | undefined,
): React.HTMLAttributes<HTMLElement> | undefined {
  if (!props) return props;

  const {
    role: _role,
    tabIndex: _tabIndex,
    "aria-roledescription": _roleDescription,
    "aria-describedby": _describedBy,
    "aria-disabled": _disabled,
    ...pointerProps
  } = props as React.HTMLAttributes<HTMLElement> & {
    "aria-roledescription"?: string;
  };

  return pointerProps;
}

/**
 * One row name that carries the state a sighted user reads at a glance. The
 * row is a grid row, not a button, so its controls stay reachable and announce
 * themselves; the name only has to cover what the cells cannot say.
 */
function buildRowLabel(row: {
  senderName: string;
  subject: string;
  dateLabel: string;
  isUnread: boolean;
}): string {
  return sprintf(
    /* translators: 1: read state, 2: sender name, 3: subject, 4: date. */
    __("%1$s message from %2$s: %3$s, %4$s", "pressedmail"),
    row.isUnread ? __("Unread", "pressedmail") : __("Read", "pressedmail"),
    row.senderName,
    row.subject,
    row.dateLabel,
  );
}

function RowStar({
  message,
  starred,
  actions,
  large,
}: {
  message: EmailMessage;
  starred: boolean;
  actions?: EmailRowActions;
  large?: boolean;
}) {
  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    actions?.onToggleStar?.(message, event);
  };

  return (
    <button
      type="button"
      className={cn(
        // 24px minimum target (WCAG 2.5.8). The glyph stays small; the hit area
        // does not. Resting colour is the full muted token: the old /45 opacity
        // measured 2.19:1 on white, under the 3:1 floor for a control.
        "inline-flex size-6 shrink-0 items-center justify-center rounded-sm transition-colors hover:bg-accent",
        starred
          ? "text-[var(--theme-starred,#f59e0b)]"
          : "text-muted-foreground hover:text-[var(--theme-starred,#f59e0b)]",
      )}
      data-starred={starred ? "true" : undefined}
      onClick={handleClick}
      aria-label={
        starred
          ? __("Starred", "pressedmail")
          : __("Not starred", "pressedmail")
      }
      title={
        starred
          ? __("Starred", "pressedmail")
          : __("Not starred", "pressedmail")
      }>
      <Star
        className={large ? "h-4 w-4" : "h-3.5 w-3.5"}
        fill={starred ? "currentColor" : "none"}
      />
    </button>
  );
}

function RowImportant({
  message,
  important,
  actions,
  large,
}: {
  message: EmailMessage;
  important: boolean;
  actions?: EmailRowActions;
  large?: boolean;
}) {
  if (!actions?.onToggleImportant) {
    return <EmailImportantMarker important={important} large={large} />;
  }

  const label = important
    ? __("Important", "pressedmail")
    : __("Not important", "pressedmail");
  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    actions.onToggleImportant?.(message, event);
  };

  return (
    <button
      type="button"
      className={cn(
        // Same 24px target and full-strength resting colour as the star.
        "inline-flex size-6 shrink-0 items-center justify-center rounded-sm transition-colors hover:bg-accent",
        important ? "text-primary" : "text-muted-foreground hover:text-primary",
      )}
      data-test="email-row-important-toggle"
      data-testid="email-row-important-toggle"
      data-important={important ? "true" : undefined}
      onClick={handleClick}
      aria-label={label}
      aria-pressed={important}
      title={label}>
      <EmailImportantMarker
        important={important}
        large={large}
        className="text-current"
        ariaHidden
      />
    </button>
  );
}

function RowFlags({
  message,
  actions,
  unreadIndicator = "dot_and_bold",
  largeIcons,
  suppressUnreadDot,
}: {
  message: EmailMessage;
  actions?: EmailRowActions;
  unreadIndicator?: EmailListUnreadIndicator;
  largeIcons?: boolean;
  suppressUnreadDot?: boolean;
}) {
  const row = buildEmailRowViewModel(message);
  const showUnreadDot =
    !suppressUnreadDot &&
    row.isUnread &&
    (unreadIndicator === "dot" || unreadIndicator === "dot_and_bold");

  return (
    <>
      <RowStar
        message={message}
        starred={row.isStarred}
        actions={actions}
        large={largeIcons}
      />
      <RowImportant
        message={message}
        important={row.isImportant}
        actions={actions}
        large={largeIcons}
      />
      {showUnreadDot && (
        <span
          data-test="email-row-unread-dot"
          data-testid="email-row-unread-dot"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
          aria-hidden="true"
        />
      )}
    </>
  );
}

function Labels({
  labels,
  extraCount,
}: {
  labels: string[];
  extraCount: number;
}) {
  if (labels.length === 0 && extraCount === 0) return null;

  return (
    <span
      data-test="email-row-labels"
      data-testid="email-row-labels"
      className="inline-flex min-w-0 shrink-0 items-center gap-1">
      {labels.map((label) => (
        <Badge
          key={label}
          variant="secondary"
          className="h-4 max-w-20 truncate px-1 py-0 text-[10px] font-normal">
          {label}
        </Badge>
      ))}
      {extraCount > 0 && (
        <span className="text-[10px] text-muted-foreground">+{extraCount}</span>
      )}
    </span>
  );
}

function Tags({
  tags,
  onTagClick,
  onTagRemove,
}: {
  tags: EmailMessageTag[];
  onTagClick?: (
    tag: EmailMessageTag,
    event: React.SyntheticEvent<HTMLElement>,
  ) => void;
  onTagRemove?: (
    tag: EmailMessageTag,
    event: React.SyntheticEvent<HTMLElement>,
  ) => void;
}) {
  if (tags.length === 0) return null;

  return (
    <EmailTagBadges
      tags={tags}
      maxVisible={3}
      expandable
      onTagClick={onTagClick}
      onTagRemove={onTagRemove}
      dataTest="email-row-tags"
      testId="email-row-tags"
    />
  );
}

function AccountBadge({
  badge,
}: {
  badge: { label: string; title: string } | null;
}) {
  if (!badge) return null;

  return (
    <Badge
      variant="outline"
      // 9px was below the 12px legibility floor this app holds itself to.
      className="h-5 max-w-24 truncate px-1 py-0 text-xs font-normal text-muted-foreground"
      title={badge.title}
      data-test="message-account-badge"
      data-testid="email-row-account-badge">
      {badge.label}
    </Badge>
  );
}

function MetaIcons({
  hasAttachment,
  showAttachmentIcon = true,
}: {
  hasAttachment: boolean;
  showAttachmentIcon?: boolean;
}) {
  if (!hasAttachment || !showAttachmentIcon) return null;

  return (
    <Paperclip
      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
      aria-label={__("Has attachment", "pressedmail")}
    />
  );
}

function HoverActions({
  message,
  actions,
  hoverActionsSlot,
  extraHoverActionsSlot,
}: {
  message: EmailMessage;
  actions?: EmailRowActions;
  hoverActionsSlot?: React.ReactNode;
  extraHoverActionsSlot?: React.ReactNode;
}) {
  if (hoverActionsSlot) {
    return <>{hoverActionsSlot}</>;
  }

  if (!actions && !extraHoverActionsSlot) return null;

  return (
    <div className="flex items-center gap-0.5">
      {actions?.onReply && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(event) => {
            event.stopPropagation();
            actions?.onReply?.(message);
          }}
          aria-label={__("Reply", "pressedmail")}>
          <EmailReplyIcon className="h-4 w-4" />
        </Button>
      )}
      {actions?.onReplyAll && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(event) => {
            event.stopPropagation();
            actions?.onReplyAll?.(message);
          }}
          aria-label={__("Reply all", "pressedmail")}>
          <EmailReplyAllIcon className="h-4 w-4" />
        </Button>
      )}
      {actions?.onForward && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(event) => {
            event.stopPropagation();
            actions?.onForward?.(message);
          }}
          aria-label={__("Forward", "pressedmail")}>
          <EmailForwardIcon className="h-4 w-4" />
        </Button>
      )}
      {actions?.onArchive && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(event) => {
            event.stopPropagation();
            actions?.onArchive?.(message);
          }}
          aria-label={__("Archive", "pressedmail")}>
          <EmailArchiveIcon className="h-4 w-4" />
        </Button>
      )}
      {actions?.onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={(event) => {
            event.stopPropagation();
            actions?.onDelete?.(message);
          }}
          aria-label={__("Delete", "pressedmail")}>
          <EmailTrashIcon className="h-4 w-4" />
        </Button>
      )}
      {actions?.onToggleRead && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(event) => {
            event.stopPropagation();
            actions?.onToggleRead?.(message);
          }}
          aria-label={__("Mark unread", "pressedmail")}>
          <EmailMarkUnreadIcon className="h-4 w-4" />
        </Button>
      )}
      {extraHoverActionsSlot}
    </div>
  );
}

function handleKeySelect(
  event: React.KeyboardEvent,
  message: EmailMessage,
  onSelect?: (message: EmailMessage) => void,
) {
  // Only the row itself opens the message. Without this guard, Enter or Space
  // on the star, the checkbox, a tag or any other control inside the row was
  // swallowed here and opened the message instead of doing its own job.
  if (event.target !== event.currentTarget) {
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect?.(message);
  }
}

function getDensityClass(density?: EmailRowDensity) {
  switch (density) {
    case "dense":
      return "h-12";
    case "compact":
      return "min-h-[52px]";
    case "loose":
      return "min-h-16";
    case "comfortable":
    default:
      return "min-h-14";
  }
}

export function EmailRow({
  message,
  variant,
  density,
  selected,
  bulkSelected = false,
  enableSelection,
  showAccountBadge,
  showSenderEmail,
  showPreview = true,
  showAttachmentIcon = true,
  unreadIndicator = "dot_and_bold",
  showHoverActions,
  isDragging,
  isPartOfDrag,
  threadGrouped,
  tabIndex,
  rowIndex,
  rowRef,
  rowStyle,
  dragHandleProps,
  selectionSlot,
  rightRailSlot,
  hoverActionsSlot,
  extraHoverActionsSlot,
  actions,
  onTagClick,
  onTagRemove,
  className,
  testId,
  onSelect,
  onMouseEnter,
  onMouseLeave,
}: EmailRowProps) {
  const showPressedGDetails =
    variant === "pressedg-table" && Boolean(showSenderEmail);
  const row = buildEmailRowViewModel(message, {
    showAccountBadge,
    showSenderEmail,
    maxPreviewLength:
      variant === "default-flat" ? 120 : showPressedGDetails ? 180 : 96,
  });
  const emphasizeUnread =
    row.isUnread &&
    (unreadIndicator === "bold" || unreadIndicator === "dot_and_bold");
  const showUnreadDot =
    row.isUnread &&
    (unreadIndicator === "dot" || unreadIndicator === "dot_and_bold");
  const rowLabel = buildRowLabel(row);
  const handleProps = pointerOnlyDragProps(dragHandleProps);
  const rowTabIndex = tabIndex ?? 0;

  if (variant === "pressedg-table") {
    return (
      <TableRow
        ref={rowRef as React.Ref<HTMLTableRowElement>}
        style={rowStyle}
        data-test={testId ?? "email-row-pressedg-table"}
        data-testid={testId ?? "email-row-pressedg-table"}
        data-row-variant={variant}
        data-message-row="true"
        data-thread-grouped={threadGrouped || undefined}
        // A table row inside the list's role="grid" table. It used to carry a
        // click handler and nothing else, so this layout could not be operated
        // from a keyboard at all.
        tabIndex={rowTabIndex}
        aria-selected={Boolean(selected)}
        aria-rowindex={rowIndex}
        aria-label={rowLabel}
        className={cn(
          "group cursor-pointer border-b border-border/60 border-l-2 border-l-transparent outline-none transition-colors hover:bg-muted/50 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
          getDensityClass(density ?? "dense"),
          showPressedGDetails && "h-auto min-h-[4.5rem]",
          selected && "bg-primary/5 hover:bg-primary/5 border-l-primary",
          threadGrouped && "border-l-4 border-l-primary",
          row.isUnread && "bg-muted/20",
          isPartOfDrag && "opacity-50",
          className,
        )}
        onClick={() => onSelect?.(message)}
        onKeyDown={(event) => handleKeySelect(event, message, onSelect)}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}>
        {enableSelection && (
          <TableCell
            className="w-9 py-1 pl-3"
            onClick={stopPropagation}
            data-test="message-left-checkbox"
            data-testid="message-left-checkbox">
            {selectionSlot}
          </TableCell>
        )}
        <TableCell className="w-12 py-1 pl-2">
          <div className="flex items-center gap-1">
            <RowFlags
              message={message}
              actions={actions}
              unreadIndicator={unreadIndicator}
              largeIcons
              suppressUnreadDot
            />
          </div>
        </TableCell>
        <TableCell className="w-44 py-1">
          <div className="relative flex min-w-0 items-center gap-1.5">
            {showUnreadDot && (
              <span
                data-test="email-row-unread-dot"
                data-testid="email-row-unread-dot"
                className="absolute -left-1 -top-0.5 h-1.5 w-1.5 -translate-x-full translate-y-1/2 shrink-0 rounded-full bg-primary"
                aria-hidden="true"
              />
            )}
            <AccountBadge badge={row.accountBadge} />
            <span
              {...handleProps}
              data-test="drag-handle"
              data-testid="email-row-sender"
              className={cn(
                "block max-w-[11rem] truncate text-sm text-foreground touch-none",
                emphasizeUnread ? "font-semibold" : "font-medium",
                isDragging ? "cursor-grabbing" : "cursor-grab",
              )}>
              {row.senderName}
            </span>
          </div>
        </TableCell>
        <TableCell className="py-1 pr-3">
          <div className="relative min-w-0">
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    data-test="email-row-subject"
                    data-testid="email-row-subject"
                    className={cn(
                      "min-w-0 truncate text-sm",
                      emphasizeUnread
                        ? "font-semibold text-foreground"
                        : "font-medium text-foreground/90",
                    )}>
                    {row.subject}
                  </span>
                  <Tags
                    tags={row.allTags}
                    onTagClick={onTagClick}
                    onTagRemove={onTagRemove}
                  />
                  <Labels
                    labels={row.visibleLabels}
                    extraCount={row.extraLabelCount}
                  />
                  <MetaIcons
                    hasAttachment={row.hasAttachment}
                    showAttachmentIcon={showAttachmentIcon}
                  />
                </div>
              </div>
              {showPreview && (
                <span
                  data-test="email-row-preview"
                  data-testid="email-row-preview"
                  className={cn(
                    "text-xs text-muted-foreground",
                    showPressedGDetails
                      ? "line-clamp-2 whitespace-normal leading-5"
                      : "truncate",
                  )}>
                  {row.preview}
                </span>
              )}
              {showPressedGDetails && row.senderEmail && (
                <span
                  data-test="message-details-row"
                  data-testid="message-details-row"
                  className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                  <span className="shrink-0 text-muted-foreground/80">
                    {__("From", "pressedmail")}
                  </span>
                  <span
                    data-test="email-row-sender-email"
                    data-testid="email-row-sender-email"
                    className="min-w-0 truncate"
                    title={row.senderEmail}>
                    {row.senderEmail}
                  </span>
                </span>
              )}
            </div>
            {showHoverActions && (
              <div
                data-test="email-row-hover-actions"
                data-testid="email-row-hover-actions"
                className="absolute inset-y-0 right-0 flex items-center bg-background/95 pl-3">
                <HoverActions
                  message={message}
                  actions={actions}
                  hoverActionsSlot={hoverActionsSlot}
                  extraHoverActionsSlot={extraHoverActionsSlot}
                />
              </div>
            )}
          </div>
        </TableCell>
        <TableCell
          className="w-24 py-1 pr-4 text-right text-xs text-muted-foreground"
          data-test="email-row-date-cell"
          data-testid="email-row-date-cell">
          <div className="flex flex-col items-end gap-0.5">
            {rightRailSlot && (
              <div
                data-test="message-right-rail-indicators"
                data-testid="message-right-rail-indicators"
                className="flex h-5 items-center justify-end gap-1"
                onClick={stopPropagation}>
                {rightRailSlot}
              </div>
            )}
            <span
              data-test="email-row-date"
              data-testid="email-row-date"
              className={cn(
                "inline-flex items-center justify-end gap-1 font-medium",
                row.isScheduled
                  ? row.scheduledStatus === "failed"
                    ? "text-destructive"
                    : "text-primary"
                  : "text-muted-foreground",
              )}>
              {row.isScheduled && (
                <ScheduledFolderIcon
                  className="h-3 w-3 shrink-0"
                  aria-label={__("Scheduled", "pressedmail")}
                />
              )}
              {row.dateLabel}
            </span>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  const isPressedOut = variant === "pressedout-classic";

  return (
    <div
      ref={rowRef as React.Ref<HTMLDivElement>}
      style={rowStyle}
      // A grid row, not a button. Children of role="button" are presentational
      // to assistive tech, which hid the star, the importance toggle and the
      // selection checkbox from screen reader users and made axe report
      // nested-interactive on every row.
      role="row"
      tabIndex={rowTabIndex}
      aria-selected={Boolean(selected)}
      aria-rowindex={rowIndex}
      data-test={variant === "default-flat" ? "message-item" : "email-row"}
      data-testid={testId ?? `email-row-${variant}`}
      data-row-variant={variant}
      data-message-row="true"
      data-thread-grouped={threadGrouped || undefined}
      data-bulk-selected={bulkSelected || undefined}
      aria-label={rowLabel}
      className={cn(
        "group grid w-full cursor-pointer grid-cols-[28px_minmax(0,1fr)_auto] gap-2 border-b border-border/60 border-l-2 border-l-transparent px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
        getDensityClass(density ?? "comfortable"),
        selected && "bg-primary/5 hover:bg-primary/5 border-l-primary",
        threadGrouped &&
          (isPressedOut
            ? "border-l-4 border-l-muted-foreground/60 pl-4"
            : "border-l-4 border-l-primary"),
        selected && "border-l-primary",
        row.isUnread && "bg-muted/20",
        bulkSelected && "border-l-primary bg-primary/10 hover:bg-primary/15",
        isPressedOut ? "rounded-none" : "rounded-none",
        isPartOfDrag && "opacity-50",
        className,
      )}
      onClick={() => onSelect?.(message)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={(event) => handleKeySelect(event, message, onSelect)}>
      <div
        role="gridcell"
        data-test="message-left-checkbox"
        data-testid="message-left-checkbox"
        className="flex items-start justify-center pt-0.5"
        onClick={stopPropagation}>
        {selectionSlot}
      </div>

      <div
        role="gridcell"
        className="flex min-w-0 flex-col justify-center gap-0.5 overflow-hidden">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <RowFlags
              message={message}
              actions={actions}
              unreadIndicator={unreadIndicator}
            />
            <AccountBadge badge={row.accountBadge} />
            <span
              {...handleProps}
              data-test="drag-handle"
              data-testid="email-row-sender"
              className={cn(
                "min-w-0 truncate text-sm text-foreground touch-none",
                emphasizeUnread ? "font-semibold" : "font-medium",
                handleProps && (isDragging ? "cursor-grabbing" : "cursor-grab"),
              )}>
              {row.senderName}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <span
            data-test="email-row-subject"
            data-testid="email-row-subject"
            className={cn(
              "min-w-0 truncate text-sm",
              emphasizeUnread
                ? "font-semibold text-foreground"
                : "font-medium text-foreground/90",
            )}>
            {row.subject}
          </span>
          <Tags
            tags={row.allTags}
            onTagClick={onTagClick}
            onTagRemove={onTagRemove}
          />
          <Labels labels={row.visibleLabels} extraCount={row.extraLabelCount} />
          <MetaIcons
            hasAttachment={row.hasAttachment}
            showAttachmentIcon={showAttachmentIcon}
          />
        </div>

        {showPreview && (
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span
              data-test="email-row-preview"
              data-testid="email-row-preview"
              className="truncate">
              {row.preview}
            </span>
          </div>
        )}

        {row.senderEmail && (
          <div
            data-test="message-details-row"
            data-testid="message-details-row"
            className="min-w-0 truncate text-xs text-muted-foreground">
            <span
              data-test="email-row-sender-email"
              data-testid="email-row-sender-email">
              {row.senderEmail}
            </span>
          </div>
        )}
      </div>

      <div
        role="gridcell"
        data-test="message-right-rail"
        data-testid="message-right-rail"
        // The date leads this column so it sits on the sender's line, the way
        // every mail client puts it. It used to be pushed to a third line by an
        // always-present indicator slot above it.
        className="flex min-w-[4.75rem] flex-col items-end gap-1">
        <span
          data-test="email-row-date"
          data-testid="email-row-date"
          className={cn(
            "inline-flex shrink-0 items-center justify-end gap-1 whitespace-nowrap text-right text-xs font-medium",
            row.isScheduled
              ? row.scheduledStatus === "failed"
                ? "text-destructive"
                : "text-primary"
              : "text-muted-foreground",
          )}>
          {row.isScheduled && (
            <ScheduledFolderIcon
              className="h-3 w-3 shrink-0"
              aria-label={__("Scheduled", "pressedmail")}
            />
          )}
          {row.dateLabel}
        </span>
        <div className="relative flex items-center justify-end gap-1">
          {/* Persistent indicators (phishing + summary). Always visible, even
              on hover. The hover-action overlay opens to their LEFT via
              right-full so it never covers them and causes no reflow. */}
          <div
            data-test="message-right-rail-indicators"
            data-testid="message-right-rail-indicators"
            className="relative z-10 flex items-center justify-end gap-1"
            onClick={stopPropagation}>
            {rightRailSlot}
            {showHoverActions && (
              <div
                data-test="email-row-hover-actions"
                data-testid="email-row-hover-actions"
                // focus-within, not hover alone: keyboard focus reaching one of
                // these actions has to reveal them too.
                className="absolute right-full top-0 mr-1 hidden items-center rounded-sm bg-background/95 group-hover:flex group-focus-within:flex">
                <HoverActions
                  message={message}
                  actions={actions}
                  hoverActionsSlot={hoverActionsSlot}
                  extraHoverActionsSlot={extraHoverActionsSlot}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailRow;
