"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { useInbox } from "@/context/InboxContext";
import { summarizeConsolidatedReadiness } from "@/lib/consolidated-account-readiness";
import { cn } from "@/lib/utils";

/**
 * Combined-inbox readiness affordance.
 *
 * When several mailboxes are combined and some are still cold/backfilling, the
 * merged page is necessarily partial. This surfaces "Syncing N of M mailboxes…"
 * so the user knows more is coming. A PERMANENTLY-failed mailbox (auth/config)
 * gets a distinct error chip instead, never a "syncing…" spinner, so the user
 * re-authenticates rather than waiting forever. Renders NOTHING for a single
 * mailbox or when every selected mailbox is ready, so single-mailbox UX is
 * unchanged.
 */
export function ConsolidatedSyncIndicator({
  className,
}: {
  className?: string;
}) {
  const { consolidatedAccountReadiness } = useInbox();
  const summary = summarizeConsolidatedReadiness(consolidatedAccountReadiness);

  if (!summary.errorLabel && !summary.label) {
    return null;
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {summary.errorLabel && (
        <div
          role="alert"
          data-test="sync-error"
          className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{summary.errorLabel}</span>
        </div>
      )}
      {summary.label && (
        <div
          role="status"
          aria-live="polite"
          data-test="sync-indicator"
          className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          <span>{summary.label}</span>
        </div>
      )}
    </div>
  );
}

export default ConsolidatedSyncIndicator;
