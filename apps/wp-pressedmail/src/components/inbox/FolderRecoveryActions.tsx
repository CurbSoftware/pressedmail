"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { Loader2, Trash2 } from "lucide-react";

import { Button, toast } from "@kit/ui/plugin";
import {
  useFolderOperations,
  useInbox,
  useMessageOperations,
} from "@/context/InboxContext";
import { ConfirmationPanel } from "@/components/shared/ConfirmationPanel";
import { useSharedMailboxRole } from "@/components/sharing";
import { getFolderRole } from "@/lib/bulk-mail-actions";
import type { EmptyFolderRole, ImapFolder } from "@/services/interfaces";

function resolveCurrentFolder(
  folders: ImapFolder[],
  selectedFolder: string | null | undefined,
): ImapFolder {
  const selected = String(selectedFolder ?? "").trim().toLowerCase();
  return (
    folders.find((folder) => {
      const path = String(folder.path ?? "").trim().toLowerCase();
      const name = String(folder.name ?? "").trim().toLowerCase();
      return selected !== "" && (path === selected || name === selected);
    }) ?? {
      name: selectedFolder || "INBOX",
      path: selectedFolder || "INBOX",
      count: 0,
    }
  );
}

// The client's folder role for Junk is "spam".
function emptyRoleFor(folder: ImapFolder): EmptyFolderRole | null {
  const role = getFolderRole(folder);
  if (role === "trash") return "trash";
  if (role === "spam") return "junk";
  return null;
}

function emptyFolderCopy(role: EmptyFolderRole) {
  return role === "junk"
    ? {
        action: __("Empty Junk", "pressedmail"),
        title: __("Empty Junk?", "pressedmail"),
        description: __(
          "This permanently deletes all messages in Junk. This action cannot be undone.",
          "pressedmail",
        ),
        done: __("Junk emptied", "pressedmail"),
        failed: __("Could not empty Junk", "pressedmail"),
      }
    : {
        action: __("Empty Trash", "pressedmail"),
        title: __("Empty Trash?", "pressedmail"),
        description: __(
          "This permanently deletes all messages in Trash. This action cannot be undone.",
          "pressedmail",
        ),
        done: __("Trash emptied", "pressedmail"),
        failed: __("Could not empty Trash", "pressedmail"),
      };
}

export function FolderRecoveryActions() {
  const { refreshMessages, selectedAccountId } = useInbox();
  // Emptying Trash or Junk deletes permanently: owners and Managers only.
  const { canManage } = useSharedMailboxRole(selectedAccountId);
  const { emptyFolder } = useMessageOperations();
  const { folders, selectedFolder, getTrashFolder } = useFolderOperations();
  const [isEmptying, setIsEmptying] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const currentFolder = resolveCurrentFolder(folders, selectedFolder);
  const role = emptyRoleFor(currentFolder);

  if (!role || !canManage) {
    return null;
  }

  const copy = emptyFolderCopy(role);
  const path =
    (role === "trash" ? getTrashFolder()?.path : undefined) ||
    currentFolder.path;

  const handleEmpty = async () => {
    setIsEmptying(true);
    try {
      const result = await emptyFolder(role, path);
      if (!result.success) {
        toast.error(result.error || copy.failed);
        return;
      }
      await refreshMessages();
      toast.success(copy.done);
    } catch {
      toast.error(copy.failed);
    } finally {
      setIsEmptying(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div
      data-test="folder-recovery-actions"
      className="flex shrink-0 items-center justify-end gap-2 border-b bg-muted/30 px-3 py-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        disabled={isEmptying}
        onClick={() => setConfirmOpen(true)}>
        {isEmptying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        {copy.action}
      </Button>
      <ConfirmationPanel
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={copy.title}
        description={copy.description}
        confirmText={__("Delete All", "pressedmail")}
        cancelText={__("Cancel", "pressedmail")}
        variant="destructive"
        loading={isEmptying}
        onConfirm={() => void handleEmpty()}
      />
    </div>
  );
}

export default FolderRecoveryActions;
