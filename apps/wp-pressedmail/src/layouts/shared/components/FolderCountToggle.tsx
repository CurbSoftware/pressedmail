"use client";

import { __ } from "@wordpress/i18n";
import { Mail, Mails } from "lucide-react";

import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import {
  useUserPreferences,
  type FolderCountMode,
} from "@/hooks/useUserPreferences";
import { SIDEBAR_NAV_ROW_ACTION_CLASS } from "@/lib/sidebar-navigation-styles";
import { cn } from "@/lib/utils";

/** Which number the folder sidebar shows: unread, or every message. */
export function useFolderCountMode(): FolderCountMode {
  return useUserPreferences().preferences.folder_count_mode === "total"
    ? "total"
    : "unread";
}

/**
 * Switches the number beside each folder between unread and total.
 *
 * One button for every sidebar. It is a sibling of the section's collapse
 * button, never a child of it, so a click here cannot fold the section.
 */
export function FolderCountToggle({ className }: { className?: string }) {
  const { updatePreference } = useUserPreferences();
  const mode = useFolderCountMode();
  const total = mode === "total";
  const Icon = total ? Mails : Mail;

  return (
    <PressedTooltip
      content={
        total
          ? __("Showing total messages", "pressedmail")
          : __("Showing unread counts", "pressedmail")
      }
      side="top">
      <button
        type="button"
        aria-pressed={total}
        aria-label={__("Show total messages in each folder", "pressedmail")}
        data-test="folder-count-toggle"
        data-count-mode={mode}
        onClick={() =>
          void updatePreference("folder_count_mode", total ? "unread" : "total")
        }
        className={cn(
          SIDEBAR_NAV_ROW_ACTION_CLASS,
          "shrink-0 hover:bg-muted hover:text-foreground",
          total ? "text-primary" : "text-muted-foreground",
          className,
        )}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </PressedTooltip>
  );
}
