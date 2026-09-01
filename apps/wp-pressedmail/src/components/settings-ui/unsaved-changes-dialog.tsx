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
  return (
    <AlertDialog open={open}>
      <PressedAlertDialogContent size="confirmation">
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
