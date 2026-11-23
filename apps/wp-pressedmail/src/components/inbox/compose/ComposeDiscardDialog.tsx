/**
 * ComposeDiscardDialog: 3-action dialog for discarding compose drafts.
 *
 * Replaces the native browser `window.confirm()` with a themed dialog offering
 * Save Draft, Delete Draft, and Keep Editing. Built on the shared `AlertDialog`
 * primitive for one consistent overlay/focus/escape/theme treatment.
 * Keep Editing is the Radix cancel action so safe initial focus, its click, and
 * dismissals all use `onOpenChange` as the single cancel callback path. Delete
 * Draft and Save Draft stay plain Buttons so each drives only its own outcome.
 *
 * @since 2.1.0
 */

import { Trash2, Save, Loader2, Undo2 } from "lucide-react";
import { __ } from "@wordpress/i18n";
import { cn, Button, AlertDialog, AlertDialogCancel } from "@kit/ui/plugin";
import {
  PressedAlertDialogContent,
  PressedAlertDialogHeader,
  PressedOverlayFooter,
} from "@/components/ui/pressed-overlay";

interface ComposeDiscardDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Save draft then close */
  onSaveDraft?: () => void;
  /** Discard without saving */
  onDelete: () => void;
  /** Return to composing */
  onCancel: () => void;
  /** Whether a draft save is in progress. Guards Save Draft only. */
  isSavingDraft?: boolean;
  /** Hide the Save Draft button (e.g. mobile compose without draft support) */
  hideSaveDraft?: boolean;
  /**
   * A scheduled email or mail merge being edited: the prompt is about the
   * changes, and discarding keeps the scheduled email as it was.
   */
  scheduled?: "email" | "merge";
}

export function ComposeDiscardDialog({
  open,
  onSaveDraft,
  onDelete,
  onCancel,
  isSavingDraft = false,
  hideSaveDraft = false,
  scheduled,
}: ComposeDiscardDialogProps) {
  // One branch, so the Free build folds the scheduled copy away.
  const copy =
    __IS_PRO__ && scheduled
      ? {
          icon: Undo2,
          title: __("Discard your changes?", "pressedmail"),
          description: __(
            "The scheduled email stays as it was.",
            "pressedmail",
          ),
          cancel: __("Keep editing", "pressedmail"),
          discard: __("Discard changes", "pressedmail"),
          save:
            scheduled === "merge"
              ? __("Review and save", "pressedmail")
              : __("Save changes", "pressedmail"),
        }
      : {
          icon: Trash2,
          title: __("Discard draft?", "pressedmail"),
          description: hideSaveDraft
            ? __("This message will not be saved.", "pressedmail")
            : __(
                "You can save this message as a draft, or delete it.",
                "pressedmail",
              ),
          cancel: __("Keep Editing", "pressedmail"),
          discard: __("Delete Draft", "pressedmail"),
          save: __("Save Draft", "pressedmail"),
        };
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Escape / dismiss routes to cancel. An IMAP save takes seconds and can
        // hang, so it must never be able to lock the user inside the dialog.
        if (!next) {
          onCancel();
        }
      }}>
      <PressedAlertDialogContent size="confirmation">
        <PressedAlertDialogHeader
          title={copy.title}
          icon={copy.icon}
          tone="destructive"
          description={copy.description}
        />

        <PressedOverlayFooter
          className={cn(
            "gap-2 sm:grid sm:space-x-0",
            hideSaveDraft ? "sm:grid-cols-2" : "sm:grid-cols-3",
          )}>
          <AlertDialogCancel asChild className="mt-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-test="discard-dialog-cancel"
              className="h-9 w-full min-w-0 px-4">
              {copy.cancel}
            </Button>
          </AlertDialogCancel>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onDelete}
            data-test="discard-dialog-delete"
            className="h-9 w-full min-w-0 px-4">
            <copy.icon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            {copy.discard}
          </Button>

          {!hideSaveDraft && onSaveDraft ? (
            <Button
              type="button"
              size="sm"
              onClick={onSaveDraft}
              disabled={isSavingDraft}
              data-test="discard-dialog-save-draft"
              className="h-9 w-full min-w-0 px-5">
              {isSavingDraft ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              )}
              {copy.save}
            </Button>
          ) : null}
        </PressedOverlayFooter>
      </PressedAlertDialogContent>
    </AlertDialog>
  );
}
