"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { Loader2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kit/ui/plugin";

import { EmailAutoTagIcon } from "@/components/icons/MailActionIcons";
import { cn } from "@/lib/utils";
import type { Tag } from "@/types/tags";

import { MAIL_ACTION_ICON_CLASS } from "./reading-pane-action-icons";

interface MailTagActionDropdownProps {
  availableTags: Tag[];
  selectedTagIds: number[];
  trigger: React.ReactNode;
  onApplyTags: (tagIds: number[]) => void | Promise<void>;
  onAutoTag?: () => void | Promise<void>;
  onOpenChange?: (open: boolean) => void | Promise<void>;
  disabled?: boolean;
  aiEnabled?: boolean;
  aiDisabled?: boolean;
  isApplying?: boolean;
  isAutoTagging?: boolean;
  align?: "start" | "center" | "end";
}

function sameTagSelection(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  return a.every((id) => bSet.has(id));
}

export function MailTagActionDropdown({
  availableTags,
  selectedTagIds,
  trigger,
  onApplyTags,
  onAutoTag,
  onOpenChange,
  disabled = false,
  aiEnabled = false,
  aiDisabled = false,
  isApplying = false,
  isAutoTagging = false,
  align = "start",
}: MailTagActionDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const [draftTagIds, setDraftTagIds] =
    React.useState<number[]>(selectedTagIds);

  React.useEffect(() => {
    if (open) {
      setDraftTagIds(selectedTagIds);
    }
  }, [open, selectedTagIds]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        setDraftTagIds(selectedTagIds);
      }
      void onOpenChange?.(nextOpen);
    },
    [onOpenChange, selectedTagIds],
  );

  const toggleTag = React.useCallback((tagId: number) => {
    setDraftTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  }, []);

  const handleApply = React.useCallback(() => {
    void Promise.resolve(onApplyTags(draftTagIds)).then(() => setOpen(false));
  }, [draftTagIds, onApplyTags]);

  const hasTagChanges = !sameTagSelection(draftTagIds, selectedTagIds);

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="w-64 overflow-hidden p-0"
        data-test="mail-tag-action-dropdown">
        {aiEnabled && (
          <>
            <DropdownMenuItem
              data-test="mail-tag-auto-tag"
              disabled={disabled || aiDisabled || isAutoTagging}
              onSelect={() => {
                setOpen(false);
                void onAutoTag?.();
              }}>
              {isAutoTagging ? (
                <Loader2
                  className={cn(MAIL_ACTION_ICON_CLASS, "mr-2 animate-spin")}
                />
              ) : (
                <EmailAutoTagIcon
                  className={cn(MAIL_ACTION_ICON_CLASS, "mr-2")}
                />
              )}
              <span className="truncate">
                {__("Auto-tag with AI", "pressedmail")}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <div className="max-h-56 overflow-y-auto p-1">
          {availableTags.length === 0 ? (
            <DropdownMenuItem disabled>
              {__("No tags yet", "pressedmail")}
            </DropdownMenuItem>
          ) : (
            availableTags.map((tag) => {
              const checked = draftTagIds.includes(tag.id);
              return (
                <DropdownMenuCheckboxItem
                  key={tag.id}
                  checked={checked}
                  data-test="mail-tag-option"
                  onCheckedChange={() => toggleTag(tag.id)}
                  onSelect={(event) => event.preventDefault()}>
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                </DropdownMenuCheckboxItem>
              );
            })
          )}
        </div>

        {/*
          Menu items, not plain buttons. Radix calls preventDefault on Tab
          inside menu content and moves the arrow keys between registered items
          only, so a <Button> sitting here could be clicked but never reached
          from a keyboard: tags could be ticked and never applied, and Escape
          threw the draft away.
        */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-test="mail-tag-clear"
          disabled={disabled || isApplying || draftTagIds.length === 0}
          onSelect={(event) => {
            // Clearing is a step, not the commit: keep the menu open.
            event.preventDefault();
            setDraftTagIds([]);
          }}>
          {__("Clear selection", "pressedmail")}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-test="mail-tag-apply"
          disabled={disabled || isApplying || !hasTagChanges}
          onSelect={(event) => {
            // Radix closes the menu on select by default. Keep it open until
            // the write settles: handleApply closes it once the promise
            // resolves, and the pending state has to stay on screen so a
            // second apply cannot be fired over the first.
            event.preventDefault();
            handleApply();
          }}>
          {isApplying && (
            <Loader2
              className={cn(MAIL_ACTION_ICON_CLASS, "mr-2 animate-spin")}
            />
          )}
          {__("Apply tags", "pressedmail")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default MailTagActionDropdown;
