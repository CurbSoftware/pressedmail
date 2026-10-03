import { useLayoutEffect, useRef } from "react";
import { __ } from "@wordpress/i18n";
import { TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
} from "@kit/ui/plugin";

import {
  PressedAlertDialogContent,
  PressedAlertDialogHeader,
  PressedOverlayFooter,
} from "@/components/ui/pressed-overlay";

interface UnsavedChangesDialogProps {
  open: boolean;
  saving?: boolean;
  onStay: () => void;
  onDiscard: () => void;
  onSave?: () => void;
}

export function UnsavedChangesDialog({
  open,
  saving = false,
  onStay,
  onDiscard,
  onSave,
}: UnsavedChangesDialogProps) {
  // Where the cursor was when the question came up, which is the control that
  // asked it: a settings nav item, a tab. The dialog has no trigger of its own,
  // and a modal Radix dialog hands the cursor back to its trigger and to nothing
  // else, so without this it fell to the top of the page and a keyboard user lost
  // their place in the sidebar. Read in a layout effect, which runs in the commit
  // that opens the dialog and before the dialog moves the focus.
  const openedFrom = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (open) {
      const held = document.activeElement;
      openedFrom.current =
        held instanceof HTMLElement && held !== document.body ? held : null;
    }
  }, [open]);

  return (
    <AlertDialog open={open}>
      <PressedAlertDialogContent
        size="confirmation"
        // Escape means "not now", which is Stay, and never Discard. The dialog is
        // controlled and had no handler, so Escape did nothing at all and a
        // keyboard user had no way out but to find the button. Only Escape is
        // taken here: the buttons do their own work. While a save is running
        // nothing can be answered, so Escape waits like they do.
        onEscapeKeyDown={(event) => {
          if (saving) {
            event.preventDefault();
            return;
          }
          onStay();
        }}
        // Back to where the question came from, if that is still on the page.
        // When it is not (leaving the page took it away), the dialog's own
        // default applies.
        onCloseAutoFocus={(event) => {
          const from = openedFrom.current;

          if (from?.isConnected) {
            event.preventDefault();
            from.focus();
          }
        }}>
        <PressedAlertDialogHeader
          title={__("Unsaved changes", "pressedmail")}
          icon={TriangleAlert}
          description={
            onSave
              ? __(
                  "You have unsaved changes. Save them before leaving or discard your changes.",
                  "pressedmail",
                )
              : __(
                  "You have unsaved changes. Discard them to leave, or stay to keep editing.",
                  "pressedmail",
                )
          }
        />
        <PressedOverlayFooter>
          <AlertDialogCancel
            type="button"
            data-test="unsaved-changes-stay"
            data-testid="unsaved-changes-stay"
            onClick={onStay}
            disabled={saving}
            className="mt-0">
            {__("Stay", "pressedmail")}
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            data-test="unsaved-changes-discard"
            data-testid="unsaved-changes-discard"
            onClick={onDiscard}
            disabled={saving}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {__("Discard changes", "pressedmail")}
          </AlertDialogAction>
          {onSave ? (
            <AlertDialogAction
              type="button"
              data-test="unsaved-changes-save"
              data-testid="unsaved-changes-save"
              onClick={onSave}
              disabled={saving}>
              {saving
                ? __("Saving...", "pressedmail")
                : __("Save changes", "pressedmail")}
            </AlertDialogAction>
          ) : null}
        </PressedOverlayFooter>
      </PressedAlertDialogContent>
    </AlertDialog>
  );
}
