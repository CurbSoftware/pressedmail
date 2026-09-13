"use client";

/**
 * Droppable Folder Component
 *
 * A folder/label item that can receive dropped emails.
 * Shared across all layouts.
 *
 * @since 2.0.0
 * @updated 3.0.0 - Moved from PressedG to shared components
 * @updated 3.1.0 - Added isCollapsed and disabled props
 */

import * as React from "react";
import { __, _n, sprintf } from "@wordpress/i18n";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { useDragDropContext } from "./DragDropProvider";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { Loader2, type LucideIcon } from "lucide-react";
import {
  SIDEBAR_NAV_ICON_CLASS,
  SIDEBAR_NAV_ITEM_CLASS,
} from "@/lib/sidebar-navigation-styles";

export interface DroppableFolderProps {
  /** Unique identifier for the folder (typically the IMAP path) */
  id: string;
  /** Display label */
  label: string;
  /** Icon component */
  icon: LucideIcon;
  /** Whether this folder is currently selected */
  isActive?: boolean;
  /** Unseen/unread count */
  unseenCount?: number;
  /** Whether the count is capped and more matching messages may exist. */
  countPartial?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional class names */
  className?: string;
  /** Whether this is a label (uses different styling) */
  isLabel?: boolean;
  /** Collapsed mode: icon-only with title tooltip */
  isCollapsed?: boolean;
  /** Disable drop target (e.g., for virtual folders like Starred) */
  disabled?: boolean;
  /** Whether this folder is still mirroring (shows a syncing spinner). */
  syncing?: boolean;
}

/** Small animated spinner shown while a folder is still mirroring. */
function FolderSyncingSpinner({ className }: { className?: string }) {
  return (
    <Loader2
      data-test="folder-syncing-indicator"
      data-testid="folder-syncing-indicator"
      aria-label={__("Syncing", "pressedmail")}
      className={cn("h-3 w-3 shrink-0 animate-spin text-primary", className)}
    />
  );
}

/**
 * Renders a folder/label navigation item that:
 * - Can receive dropped emails
 * - Shows visual feedback when dragged over
 * - Displays unseen count badge
 * - Supports collapsed (icon-only) mode
 */
export function DroppableFolder({
  id,
  label,
  icon: Icon,
  isActive = false,
  unseenCount,
  countPartial = false,
  onClick,
  className,
  isLabel = false,
  isCollapsed = false,
  disabled = false,
  syncing = false,
}: DroppableFolderProps) {
  const { isDragging, activeDropZone } = useDragDropContext();

  const { isOver, setNodeRef } = useDroppable({
    id: `folder-${id}`,
    disabled,
  });

  const isDropTarget =
    !disabled && (isOver || activeDropZone === `folder-${id}`);
  const countLabel =
    unseenCount !== undefined
      ? countPartial
        ? "2000+"
        : String(unseenCount)
      : undefined;

  // The unread count is part of what this row says. Sighted users read it from
  // the badge (or the tooltip when collapsed); the accessible name has to carry
  // it too, or a screen reader announces "Inbox" whether or not 38 messages are
  // waiting.
  const accessibleLabel =
    unseenCount === undefined || !(countPartial || unseenCount > 0)
      ? label
      : countPartial
        ? sprintf(
            /* translators: 1: folder name, 2: capped unread count. */
            __("%1$s, more than %2$d unread", "pressedmail"),
            label,
            2000,
          )
        : sprintf(
            /* translators: 1: folder name, 2: number of unread messages. */
            _n(
              "%1$s, %2$d unread message",
              "%1$s, %2$d unread messages",
              unseenCount,
              "pressedmail",
            ),
            label,
            unseenCount,
          );

  if (isCollapsed) {
    const tooltipLabel =
      unseenCount !== undefined && (countPartial || unseenCount > 0)
        ? `${label} (${countLabel})`
        : label;
    return (
      <PressedTooltip content={tooltipLabel} side="right">
        <button
          ref={setNodeRef}
          onClick={onClick}
          data-test="folder-item"
          data-testid="folder-item"
          data-folder={id}
          aria-current={isActive ? "page" : undefined}
          aria-label={accessibleLabel}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md transition-all",
            isActive && !isDragging
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "text-foreground hover:bg-muted",
            isDragging && [
              "ring-2 ring-inset ring-transparent",
              isDropTarget && "bg-primary/20 ring-primary text-primary",
            ],
            className,
          )}>
          {syncing ? (
            <FolderSyncingSpinner
              className={cn(
                "h-4 w-4",
                isActive && !isDragging && "text-primary-foreground",
              )}
            />
          ) : (
            <Icon
              className={cn(
                "h-4 w-4",
                isActive && !isDragging
                  ? "text-primary-foreground"
                  : "text-current",
                isDragging && isDropTarget && "text-primary",
              )}
            />
          )}
        </button>
      </PressedTooltip>
    );
  }

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      data-test="folder-item"
      data-testid="folder-item"
      data-folder={id}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        SIDEBAR_NAV_ITEM_CLASS,
        "w-full transition-all",
        isLabel ? "rounded-r-full py-1.5" : "rounded-r-full py-2",
        isActive && !isDragging
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted",
        isDragging && [
          "ring-2 ring-inset ring-transparent",
          isDropTarget && "bg-primary/20 ring-primary text-primary",
        ],
        className,
      )}>
      <Icon
        className={cn(
          SIDEBAR_NAV_ICON_CLASS,
          isActive && !isDragging ? "text-primary" : "text-muted-foreground",
          isDragging && isDropTarget && "text-primary",
        )}
      />
      <span className="flex-1 text-left truncate">{label}</span>
      {syncing ? (
        <FolderSyncingSpinner />
      ) : (
        unseenCount !== undefined &&
        (countPartial || unseenCount > 0) && (
          <span
            className={cn(
              "text-xs font-bold",
              isActive && !isDragging ? "text-primary" : "text-foreground",
              isDragging && isDropTarget && "text-primary",
            )}>
            {countLabel}
          </span>
        )
      )}
    </button>
  );
}

export default DroppableFolder;
