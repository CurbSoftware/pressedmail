"use client";

import * as React from "react";
import { __, sprintf } from "@wordpress/i18n";
import { Button, Input, Popover, PopoverTrigger, cn } from "@kit/ui/plugin";
import { FolderPlus, Loader2, Pencil, Trash2, X } from "lucide-react";
import {
  PressedOverlayBody,
  PressedOverlayError,
  PressedOverlayFooter,
  PressedPopoverContent,
} from "@/components/ui/pressed-overlay";
import type { FolderOperationResult } from "@/layouts/shared/hooks/useFolderOperations";
import type { ImapFolder } from "@/services/interfaces";
import { getEligibleFolderParents } from "./ProviderFolderTree";

type FolderCrudMode = "create" | "manage";

type OperationResult = FolderOperationResult | void;
const EMPTY_FOLDERS: ImapFolder[] = [];

export interface FolderCrudPopoverProps {
  mode: FolderCrudMode;
  children: React.ReactNode;
  /**
   * Styling for the trigger element itself.
   *
   * `PopoverTrigger` hardcodes button chrome, `bg-card`, `rounded-md` and a
   * fixed `h-9`, and merges it with its OWN className through `cn()`. With
   * `asChild`, the child's className never reaches that merge: Radix's Slot
   * concatenates the two strings, so tailwind-merge never sees the conflict
   * and both `h-9` and the child's height survive. `.h-9` is emitted after
   * `.h-6` in the bundle, so the taller one won and every folder row's 3-dot
   * button rendered at 36px.
   *
   * Anything the trigger must override belongs here, not on the child.
   */
  triggerClassName?: string;
  folderPath?: string;
  folderName?: string;
  folderId?: number | null;
  accountId?: number;
  folders?: ImapFolder[];
  isSystem?: boolean;
  providerLabel?: "folder" | "label";
  onCreate?: (
    name: string,
    parentId?: number | null,
  ) => Promise<OperationResult>;
  onRename?: (
    path: string,
    newName: string,
    parentId?: number | null,
  ) => Promise<OperationResult>;
  onDelete?: (path: string) => Promise<OperationResult>;
  onSuccess?: (details: {
    mode: FolderCrudMode;
    parentId: number | null | undefined;
  }) => void;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

function operationSucceeded(result: OperationResult): boolean {
  if (result && typeof result === "object" && "success" in result) {
    return Boolean(result.success);
  }
  return true;
}

function operationError(result: OperationResult): string | null {
  if (result && typeof result === "object" && "error" in result) {
    return result.error ?? null;
  }
  return null;
}

export function FolderCrudPopover({
  mode,
  children,
  triggerClassName,
  folderPath = "",
  folderName = "",
  folderId = null,
  accountId,
  folders = EMPTY_FOLDERS,
  isSystem = false,
  providerLabel = "folder",
  onCreate,
  onRename,
  onDelete,
  onSuccess,
  align = "end",
  side = "right",
}: FolderCrudPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<"menu" | "form" | "delete">(
    mode === "create" ? "form" : "menu",
  );
  const [name, setName] = React.useState("");
  const [parentId, setParentId] = React.useState<number | null | undefined>(
    null,
  );
  const initialParentIdRef = React.useRef<number | null | undefined>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const label =
    providerLabel === "label"
      ? __("label", "pressedmail")
      : __("folder", "pressedmail");
  const capitalLabel =
    providerLabel === "label"
      ? __("Label", "pressedmail")
      : __("Folder", "pressedmail");

  React.useEffect(() => {
    if (!open) return;
    setView(mode === "create" ? "form" : "menu");
    setName(mode === "create" ? "" : folderName);
    const flatten = (nodes: ImapFolder[]): ImapFolder[] =>
      nodes.flatMap((folder) => [folder, ...flatten(folder.children ?? [])]);
    const current = flatten(folders).find((folder) => folder.id === folderId);
    const initialParentId =
      mode === "manage"
        ? current
          ? (current.parentId ?? current.parent_id ?? null)
          : undefined
        : null;
    initialParentIdRef.current = initialParentId;
    setParentId(initialParentId);
    setError(null);
    setLoading(false);
  }, [folderId, folderName, folders, mode, open]);

  const parentOptions = React.useMemo(
    () =>
      accountId === undefined
        ? []
        : getEligibleFolderParents(folders, {
            accountId,
            currentFolderId: mode === "manage" ? folderId : null,
          }),
    [accountId, folderId, folders, mode],
  );
  const selectedParent = React.useMemo(
    () =>
      folders
        .flatMap(function flatten(folder): ImapFolder[] {
          return [folder, ...(folder.children ?? []).flatMap(flatten)];
        })
        .find((folder) => folder.id === parentId),
    [folders, parentId],
  );
  const pathPreview = React.useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return "";
    if (!selectedParent) return trimmed;
    if (selectedParent.delimiterState === "value" && selectedParent.delimiter) {
      return `${selectedParent.path}${selectedParent.delimiter}${trimmed}`;
    }
    return `${selectedParent.path} › ${trimmed}`;
  }, [name, selectedParent]);

  React.useEffect(() => {
    if (open && view === "form") {
      window.setTimeout(() => {
        inputRef.current?.focus();
        if (mode === "manage") inputRef.current?.select();
      }, 0);
    }
  }, [mode, open, view]);

  const finishSuccess = React.useCallback(() => {
    onSuccess?.({ mode, parentId });
    setOpen(false);
  }, [mode, onSuccess, parentId]);

  const handleSubmit = React.useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(__("Folder name is required", "pressedmail"));
      return;
    }

    if (
      mode === "manage" &&
      trimmed === folderName &&
      parentId === initialParentIdRef.current
    ) {
      setView("menu");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result =
        mode === "create"
          ? accountId === undefined
            ? await onCreate?.(trimmed)
            : await onCreate?.(trimmed, parentId)
          : accountId === undefined
            ? await onRename?.(folderPath, trimmed)
            : await onRename?.(folderPath, trimmed, parentId);
      if (operationSucceeded(result)) {
        finishSuccess();
        return;
      }
      setError(
        operationError(result) ??
          (mode === "create"
            ? __("Failed to create folder", "pressedmail")
            : __("Failed to rename folder", "pressedmail")),
      );
    } catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : mode === "create"
            ? __("Failed to create folder", "pressedmail")
            : __("Failed to rename folder", "pressedmail"),
      );
    } finally {
      setLoading(false);
    }
  }, [
    accountId,
    finishSuccess,
    folderName,
    folderPath,
    mode,
    name,
    onCreate,
    onRename,
    parentId,
  ]);

  const handleDelete = React.useCallback(async () => {
    if (!folderPath) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onDelete?.(folderPath);
      if (operationSucceeded(result)) {
        finishSuccess();
        return;
      }
      setError(
        operationError(result) ?? __("Failed to delete folder", "pressedmail"),
      );
    } catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : __("Failed to delete folder", "pressedmail"),
      );
    } finally {
      setLoading(false);
    }
  }, [finishSuccess, folderPath, onDelete]);

  const title =
    mode === "create"
      ? sprintf(
          /* translators: %s: folder or label. */
          __("New %s", "pressedmail"),
          label,
        )
      : folderName;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next && loading) return;
        setOpen(next);
      }}>
      <PopoverTrigger asChild className={triggerClassName}>
        {children}
      </PopoverTrigger>
      <PressedPopoverContent
        size="menu"
        role="dialog"
        align={align}
        side={side}
        data-test="folder-crud-popover"
        data-testid="folder-crud-popover">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            {mode === "create" ? (
              <FolderPlus className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <Pencil className="h-4 w-4 shrink-0 text-primary" />
            )}
            <span className="truncate">{title}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={__("Close", "pressedmail")}
            onClick={() => setOpen(false)}
            disabled={loading}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {mode === "manage" && view === "menu" && (
          <PressedOverlayBody className="space-y-2">
            {isSystem ? (
              <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {__(
                  "Protected folder. Rename and delete are not available.",
                  "pressedmail",
                )}
              </p>
            ) : (
              <div className="grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-start gap-2"
                  onClick={() => {
                    setName(folderName);
                    setView("form");
                  }}>
                  <Pencil className="h-4 w-4" />
                  {__("Rename", "pressedmail")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="justify-start gap-2"
                  onClick={() => setView("delete")}>
                  <Trash2 className="h-4 w-4" />
                  {__("Delete", "pressedmail")}
                </Button>
              </div>
            )}
          </PressedOverlayBody>
        )}

        {view === "form" && (
          <>
            <PressedOverlayBody className="space-y-3">
              {accountId !== undefined && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="folder-crud-parent"
                    className="text-xs font-medium text-muted-foreground">
                    {__("Parent folder", "pressedmail")}
                  </label>
                  <select
                    id="folder-crud-parent"
                    value={parentId ?? ""}
                    disabled={loading}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setParentId(value === "" ? null : Number(value));
                    }}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground">
                    <option value="">{__("Root", "pressedmail")}</option>
                    {parentOptions.map((option) => (
                      <option key={option.folderId} value={option.folderId}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <label
                  htmlFor="folder-crud-name"
                  className="text-xs font-medium text-muted-foreground">
                  {__("Folder name", "pressedmail")}
                </label>
                <Input
                  autoComplete="off"
                  ref={inputRef}
                  id="folder-crud-name"
                  value={name}
                  disabled={loading}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setName(event.currentTarget.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === "Enter" && !loading) {
                      void handleSubmit();
                    }
                    if (event.key === "Escape" && !loading) {
                      if (mode === "manage") setView("menu");
                      else setOpen(false);
                    }
                  }}
                  placeholder={__("e.g., Receipts", "pressedmail")}
                  className={cn("h-8", error && "border-destructive")}
                />
              </div>
              {pathPreview && (
                <p
                  className="truncate rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground"
                  title={pathPreview}>
                  {pathPreview}
                </p>
              )}
              {error && (
                <PressedOverlayError className="text-xs">
                  {error}
                </PressedOverlayError>
              )}
            </PressedOverlayBody>
            <PressedOverlayFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => {
                  if (mode === "manage") setView("menu");
                  else setOpen(false);
                }}>
                {__("Cancel", "pressedmail")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={loading || !name.trim()}
                onClick={() => void handleSubmit()}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create"
                  ? __("Create", "pressedmail")
                  : __("Save", "pressedmail")}
              </Button>
            </PressedOverlayFooter>
          </>
        )}

        {mode === "manage" && view === "delete" && (
          <>
            <PressedOverlayBody className="space-y-3">
              <p className="text-sm text-foreground">
                {sprintf(
                  /* translators: %s: folder name. */
                  __('Delete "%s"?', "pressedmail"),
                  folderName,
                )}
              </p>
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {__(
                  "Deleting a folder is provider-backed. Depending on your mail server, messages in this folder may be deleted or moved.",
                  "pressedmail",
                )}
              </p>
              {error && (
                <PressedOverlayError className="text-xs">
                  {error}
                </PressedOverlayError>
              )}
            </PressedOverlayBody>
            <PressedOverlayFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => setView("menu")}>
                {__("Cancel", "pressedmail")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={loading}
                onClick={() => void handleDelete()}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {__("Delete folder", "pressedmail")}
              </Button>
            </PressedOverlayFooter>
          </>
        )}
      </PressedPopoverContent>
    </Popover>
  );
}

export default FolderCrudPopover;
