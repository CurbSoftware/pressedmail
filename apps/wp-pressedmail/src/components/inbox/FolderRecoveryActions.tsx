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
import { getFolderRole } from "@/lib/bulk-mail-actions";
import type { ImapFolder } from "@/services/interfaces";

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

export function FolderRecoveryActions() {
  const { refreshMessages } = useInbox();
  const { emptyTrash } = useMessageOperations();
  const { folders, selectedFolder, getTrashFolder } = useFolderOperations();
  const [isEmptying, setIsEmptying] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const currentFolder = resolveCurrentFolder(folders, selectedFolder);
  const isTrash = getFolderRole(currentFolder) === "trash";

  if (!isTrash) {
    return null;
  }

  const trashPath = getTrashFolder()?.path || currentFolder.path || "Trash";

  const handleEmptyTrash = async () => {
    setIsEmptying(true);
    try {
      const result = await emptyTrash(trashPath);
      if (!result.success) {
        toast.error(result.error || __("Could not empty Trash", "pressedmail"));
        return;
      }
      await refreshMessages();
      toast.success(__("Trash emptied", "pressedmail"));
    } catch {
      toast.error(__("Could not empty Trash", "pressedmail"));
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
        {__("Empty Trash", "pressedmail")}
      </Button>
      <ConfirmationPanel
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={__("Empty Trash?", "pressedmail")}
        description={__(
          "This permanently deletes all messages in Trash. This action cannot be undone.",
          "pressedmail",
        )}
        confirmText={__("Delete All", "pressedmail")}
        cancelText={__("Cancel", "pressedmail")}
        variant="destructive"
        loading={isEmptying}
        onConfirm={() => void handleEmptyTrash()}
      />
    </div>
  );
}

export default FolderRecoveryActions;
