"use client";

/**
 * Bulk action status indicator
 *
 * Shows a trash-bag icon on a row while a bulk mutation (move to junk,
 * delete, not spam, restore) is running against it, and colors it by
 * outcome once its chunk responds. The phishing indicator's row-feedback
 * pattern applied to list mutations: red for spam and delete, green for
 * not spam and restore, yellow while in flight.
 */

import { __ } from "@wordpress/i18n";

import { EmailTrashIcon } from "@/components/icons/MailActionIcons";
import type {
  BulkActionKind,
  BulkActionPhase,
} from "@/context/bulk-action/bulk-action-status-store";
import { useBulkActionStatus } from "@/context/bulk-action/bulk-action-status-store";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<BulkActionKind, Record<BulkActionPhase, string>> = {
  "mark-spam": {
    running: __("Moving to junk…", "pressedmail"),
    done: __("Moved to junk", "pressedmail"),
    failed: __("Move to junk failed", "pressedmail"),
  },
  delete: {
    running: __("Deleting…", "pressedmail"),
    done: __("Deleted", "pressedmail"),
    failed: __("Delete failed", "pressedmail"),
  },
  "not-spam": {
    running: __("Marking as not spam…", "pressedmail"),
    done: __("Marked as not spam", "pressedmail"),
    failed: __("Could not mark as not spam", "pressedmail"),
  },
  restore: {
    running: __("Restoring…", "pressedmail"),
    done: __("Restored", "pressedmail"),
    failed: __("Restore failed", "pressedmail"),
  },
};

function getStatusColor(action: BulkActionKind, phase: BulkActionPhase): string {
  if (phase === "running") return "text-warning";
  if (phase === "failed") return "text-destructive";
  return action === "not-spam" || action === "restore"
    ? "text-success"
    : "text-destructive";
}

interface BulkActionStatusIndicatorProps {
  messageId: string;
  className?: string;
}

/**
 * Bulk action status indicator
 *
 * Renders nothing until a bulk action touches the row.
 */
export function BulkActionStatusIndicator({
  messageId,
  className,
}: BulkActionStatusIndicatorProps) {
  const status = useBulkActionStatus(messageId);

  if (!status) {
    return null;
  }

  return (
    <span
      data-test="bulk-action-indicator"
      data-testid="bulk-action-indicator"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap",
        className,
      )}
      role="img"
      aria-label={STATUS_LABELS[status.action][status.phase]}>
      <EmailTrashIcon
        className={cn("h-4 w-4", getStatusColor(status.action, status.phase))}
      />
    </span>
  );
}

export default BulkActionStatusIndicator;
