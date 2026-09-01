"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { Loader2 } from "lucide-react";

import {
  Button,
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
  const [draftTagIds, setDraftTagIds] = React.useState<number[]>(
    selectedTagIds,
  );

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

        <div className="flex items-center justify-between gap-2 border-t border-border p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={disabled || isApplying || draftTagIds.length === 0}
            onClick={() => setDraftTagIds([])}>
            {__("Clear selection", "pressedmail")}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={disabled || isApplying || !hasTagChanges}
            onClick={handleApply}>
            {isApplying && (
              <Loader2
                className={cn(MAIL_ACTION_ICON_CLASS, "mr-1 animate-spin")}
              />
            )}
            {__("Apply tags", "pressedmail")}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default MailTagActionDropdown;
