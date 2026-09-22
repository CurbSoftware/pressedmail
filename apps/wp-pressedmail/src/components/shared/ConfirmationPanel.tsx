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
import {
  AlertDialog,
  AlertDialogCancel,
  Button,
} from "@kit/ui/plugin";
import {
  PressedAlertDialogContent,
  PressedAlertDialogHeader,
  PressedOverlayFooter,
} from "@/components/ui/pressed-overlay";

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
        size="confirmation"
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
          <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
          {/* Confirm is a plain Button (not AlertDialogAction) so it does NOT
              auto-close: the caller drives the close after onConfirm resolves,
              keeping the dialog open to show the loading state. */}
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
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
