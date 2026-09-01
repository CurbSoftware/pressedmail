"use client";

import { __, sprintf } from "@wordpress/i18n";
import {
  ArrowLeftRight,
  CheckSquare,
  Mail,
  Square,
  Star,
  X,
} from "lucide-react";

import { getMessageIdentityKey } from "@/lib/message-identity";
import { cn } from "@/lib/utils";
import { useInboxState } from "@/context/InboxContext";
import { useEmailSelection } from "@/context/selection";
import { EmailImportantIcon } from "@/components/icons/MailActionIcons";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kit/ui/plugin";

export interface EmailListSelectMenuProps {
  className?: string;
}

export function EmailListSelectMenu({ className }: EmailListSelectMenuProps) {
  const {
    selectAll,
    deselectAll,
    selectMultiple,
    selectedIds,
    hasSelection,
    getSelectedCount,
  } = useEmailSelection();
  const { messages } = useInboxState();

  const selectedCount = getSelectedCount();
  const triggerLabel =
    selectedCount > 0
      ? sprintf(__("%d selected", "pressedmail"), selectedCount)
      : __("Select", "pressedmail");
  const triggerAriaLabel =
    selectedCount > 0 ? triggerLabel : __("Select messages", "pressedmail");

  // "Select all" selects the currently-loaded/visible rows: selectAll() builds
  // its set from filteredMessages, which is the current page (paginated) or all
  // loaded rows (lazy load). There is no separate "current page" option.
  const handleSelectUnread = () => {
    const unreadIds = messages
      .filter((message) => !message.read)
      .map((message) => getMessageIdentityKey(message));
    deselectAll();
    if (unreadIds.length > 0) {
      selectMultiple(unreadIds);
    }
  };

  const handleSelectStarred = () => {
    const starredIds = messages
      .filter((message) => message.starred)
      .map((message) => getMessageIdentityKey(message));
    deselectAll();
    if (starredIds.length > 0) {
      selectMultiple(starredIds);
    }
  };

  const handleSelectImportant = () => {
    const importantIds = messages
      .filter((message) => message.important)
      .map((message) => getMessageIdentityKey(message));
    deselectAll();
    if (importantIds.length > 0) {
      selectMultiple(importantIds);
    }
  };

  const handleInvert = () => {
    const allIds = messages.map((message) => getMessageIdentityKey(message));
    const currentSelected = new Set(selectedIds);
    const invertedIds = allIds.filter((id) => !currentSelected.has(id));
    deselectAll();
    if (invertedIds.length > 0) {
      selectMultiple(invertedIds);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 shrink-0 gap-1.5 px-2 text-xs", className)}
          aria-label={triggerAriaLabel}>
          {hasSelection() ? (
            <CheckSquare className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          <span>{triggerLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuItem onClick={selectAll}>
          <CheckSquare className="mr-2 h-4 w-4" />
          {__("Select all", "pressedmail")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleSelectUnread}>
          <Mail className="mr-2 h-4 w-4" />
          {__("Unread", "pressedmail")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSelectStarred}>
          <Star className="mr-2 h-4 w-4" />
          {__("Starred", "pressedmail")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSelectImportant}>
          <EmailImportantIcon className="mr-2 h-4 w-4" />
          {__("Important", "pressedmail")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleInvert}>
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          {__("Invert", "pressedmail")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={deselectAll}>
          <X className="mr-2 h-4 w-4" />
          {__("None", "pressedmail")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default EmailListSelectMenu;
