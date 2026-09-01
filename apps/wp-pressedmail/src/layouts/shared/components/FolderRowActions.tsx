import { MoreHorizontal } from "lucide-react";
import { __ } from "@wordpress/i18n";
import { cn } from "@kit/ui/plugin";

import type * as React from "react";

import { FolderCrudPopover } from "@/layouts/shared/components/FolderCrudPopover";
import type { ProviderFolderTarget } from "@/layouts/shared/components/ProviderFolderTree";
import type { ImapFolder } from "@/services/interfaces";
import { SIDEBAR_NAV_ROW_ACTION_CLASS } from "@/lib/sidebar-navigation-styles";

/**
 * The 3-dot manage menu on a user folder row.
 *
 * All three layouts rendered this, character for character, except that they
 * disagreed on the hover reveal: the default layout faded it in on row hover,
 * PressedG pinned it at 70% and never revealed it, and PressedOut left it
 * fully opaque at all times. PressedOut also dropped `providerLabel`, so its
 * Gmail users were offered to delete a "folder" where the others said "label".
 * One implementation, so those cannot drift apart again.
 */
export interface FolderRowActionsProps {
  target: ProviderFolderTarget;
  accountId: number;
  folders: ImapFolder[];
  provider?: string | null;
  onRename: React.ComponentProps<typeof FolderCrudPopover>["onRename"];
  onDelete: React.ComponentProps<typeof FolderCrudPopover>["onDelete"];
}

export function FolderRowActions({
  target,
  accountId,
  folders,
  provider,
  onRename,
  onDelete,
}: FolderRowActionsProps) {
  // Synthetic and unselectable nodes are display-only, there is nothing on
  // the server to rename or delete.
  if (
    target.folder.selectable === false ||
    target.folder.source === "synthetic"
  ) {
    return null;
  }

  return (
    <span onClick={(event) => event.stopPropagation()}>
      <FolderCrudPopover
        mode="manage"
        accountId={accountId}
        folders={folders}
        folderId={target.folderId}
        providerLabel={provider === "gmail" ? "label" : "folder"}
        folderPath={target.path}
        folderName={target.folder.name}
        onRename={onRename}
        onDelete={onDelete}
        // On the trigger, not the button: PopoverTrigger only tailwind-merges
        // its own className, and `asChild` concatenates the child's. Left on
        // the child, every one of these lost to the trigger's own chrome,
        // `h-6` to `h-9` (a 36px button in a 32px row), `rounded-sm` to
        // `rounded-md`, `hover:bg-muted` to `hover:bg-card`.
        triggerClassName={cn(
          SIDEBAR_NAV_ROW_ACTION_CLASS,
          "text-muted-foreground opacity-70 transition-opacity",
          "hover:bg-muted hover:text-foreground group-hover/folder-tree:opacity-100",
          // The trigger no longer injects a focus ring on asChild children.
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}>
        <button
          type="button"
          data-test="folder-row-actions-trigger"
          aria-label={__("Folder actions", "pressedmail")}>
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </FolderCrudPopover>
    </span>
  );
}

export default FolderRowActions;
