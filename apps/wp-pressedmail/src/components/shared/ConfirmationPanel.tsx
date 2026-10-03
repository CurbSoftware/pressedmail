/**
 * Confirmation Panel Component
 *
 * Thin wrapper over the shared `AlertDialog` primitive (`@kit/ui/plugin`) that
 * keeps the original public prop contract. Standardized onto the primitive so
 * every confirm/destructive dialog shares one look, focus trap, escape handling,
 * and theme-token chrome. The primitive already portals content through a
 * theme-class wrapper, so it inherits the plugin theme variables.
 *
 * @since 1.3.1
 */

import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogCancel, Button, cn } from "@kit/ui/plugin";
import {
  PressedAlertDialogContent,
  PressedAlertDialogHeader,
  PressedOverlayFooter,
  type PressedOverlaySize,
} from "@/components/ui/pressed-overlay";

/**
 * The solid fill the app's delete dialogs use for the confirming verb. The
 * kit's soft destructive tint read as disabled next to a bordered Cancel.
 * Hover darkens rather than fades, so the white text keeps its contrast.
 * Pair it with `variant="default"`: the kit's destructive variant carries
 * `dark:` tints that would win over this in dark mode. No focus ring here:
 * tailwind-base.css owns focus appearance, and a faint red ring on top of it
 * was both a second indicator and under 3:1 against a white card.
 */
export const DESTRUCTIVE_CONFIRM_CLASS =
  "bg-destructive text-destructive-foreground hover:bg-destructive hover:brightness-90";

/**
 * One error line inside a dialog, under the body text and as wide as it.
 * Stop sharing and Leave both use it, so a failure looks the same in both.
 * The icon keeps it from being colour alone.
 */
export const DIALOG_ERROR_CLASS =
  "flex w-full items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 [font-size:inherit] font-medium text-destructive [text-wrap:pretty]";

export interface ConfirmationPanelProps {
  /** Whether the panel is open */
  open: boolean;
  /** Callback when panel should close */
  onOpenChange: (open: boolean) => void;
  /** Panel title */
  title: string;
  /** Description/message to display */
  description: React.ReactNode;
  /** Callback when user confirms */
  onConfirm: () => void | Promise<void>;
  /** Optional callback when user cancels */
  onCancel?: () => void;
  /** Restore focus when the opener was a menu item that has unmounted. */
  onCloseAutoFocus?: (event: Event) => void;
  /** Text for confirm button */
  confirmText?: string;
  /** Text for cancel button */
  cancelText?: string;
  /** Variant affects styling */
  variant?: "default" | "destructive";
  /** Whether the action is in progress */
  loading?: boolean;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Width tier. A confirm stacked on a narrower dialog should match it. */
  size?: Extract<PressedOverlaySize, "confirmation" | "paletteForm">;
  /**
   * "top" pins the top edge (tailwind-base.css), so an error line appearing
   * grows the box downward instead of moving it under the pointer.
   */
  anchor?: "top";
}

export function ConfirmationPanel({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  onCancel,
  onCloseAutoFocus,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  loading = false,
  icon,
  size = "confirmation",
  anchor,
}: ConfirmationPanelProps) {
  // Bare icon; AlertDialogTitleRow sizes (h-5 w-5) and colors it via `variant`.
  const leadingIcon =
    icon ?? (variant === "destructive" ? <AlertTriangle /> : null);

  // A single close path: Escape, cancel button, or programmatic close all route
  // through here. Block while an action is in progress (mirrors the original).
  const handleOpenChange = (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (loading) {
      return;
    }
    onOpenChange(false);
    onCancel?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <PressedAlertDialogContent
        size={size}
        data-pm-anchor={anchor}
        onCloseAutoFocus={onCloseAutoFocus}>
        {/* `icon` is a node, not a component, so it rides inside the title. */}
        <PressedAlertDialogHeader
          title={
            <span className="flex min-w-0 items-center gap-2">
              {leadingIcon}
              <span>{title}</span>
            </span>
          }
          tone={variant === "destructive" ? "destructive" : "default"}
          description={description}
        />
        <PressedOverlayFooter>
          {/* Cancel auto-closes via the primitive, which fires handleOpenChange
              → onCancel. Do not also wire onClick here or it double-fires. */}
          {/* max-sm: 44px touch targets on phones, where the pair stacks. */}
          <AlertDialogCancel disabled={loading} className="max-sm:min-h-11">
            {cancelText}
          </AlertDialogCancel>
          {/* Confirm is a plain Button (not AlertDialogAction) so it does NOT
              auto-close: the caller drives the close after onConfirm resolves,
              keeping the dialog open to show the loading state. */}
          {/* focusableWhenDisabled: a plain disabled button drops focus while
              the action runs, so after a failure the retry had no focus. */}
          <Button
            type="button"
            focusableWhenDisabled
            variant="default"
            data-variant={variant}
            className={cn(
              "max-sm:min-h-11",
              variant === "destructive" && DESTRUCTIVE_CONFIRM_CLASS,
            )}
            onClick={() => {
              void onConfirm();
            }}
            disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </Button>
        </PressedOverlayFooter>
      </PressedAlertDialogContent>
    </AlertDialog>
  );
}

export default ConfirmationPanel;
