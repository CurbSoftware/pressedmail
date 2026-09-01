import { memo } from "react";
import { __ } from "@wordpress/i18n";
import { Inbox } from "lucide-react";

import { Button } from "@kit/ui/plugin";
import { EmailRefreshIcon } from "@/components/icons/MailActionIcons";
import { useMailOperations } from "@/layouts/shared/hooks/useMailOperations";
import { cn } from "@/lib/utils";

interface InboxEmptyStateProps {
  className?: string;
  /** Title override (e.g. an error heading). Defaults to "No messages". */
  title?: string;
  /** Subtitle override. Ignored while a fetch is in flight ("Syncing…"). */
  description?: string;
}

/**
 * Shared empty-state for the message list across every layout variant.
 *
 * Shows the inbox icon + a short message and a "Get emails" button that
 * force-refreshes the current folder, so a user can fetch from a folder that is
 * empty (or still warming) without hunting for a toolbar refresh. While a fetch
 * is in flight it shows a "Syncing…" affordance instead of a bare blank.
 * Self-wires via useMailOperations so it can be dropped into any list view.
 */
export const InboxEmptyState = memo(function InboxEmptyState({
  className,
  title,
  description,
}: InboxEmptyStateProps) {
  const { refreshMessages, isLoading, isRefreshing } = useMailOperations();
  const busy = isLoading || isRefreshing;

  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-3 p-8 text-center",
        className,
      )}
      data-test="inbox-empty">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h3 className="font-medium text-sm">
          {title ?? __("No messages", "pressedmail")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {busy
            ? __("Syncing…", "pressedmail")
            : (description ?? __("This folder is empty", "pressedmail"))}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void refreshMessages()}
        disabled={busy}
        className="h-7 text-xs"
        data-test="empty-state-refresh">
        <EmailRefreshIcon className={cn("h-3 w-3 mr-1", busy && "animate-spin")} />
        {busy ? __("Syncing…", "pressedmail") : __("Get emails", "pressedmail")}
      </Button>
    </div>
  );
});

export default InboxEmptyState;
