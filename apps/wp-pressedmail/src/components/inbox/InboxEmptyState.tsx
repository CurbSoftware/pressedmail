import { memo } from "react";
import { __, sprintf } from "@wordpress/i18n";
import {
  AlertCircle,
  Clock,
  Inbox,
  SearchX,
  SendHorizonal,
} from "lucide-react";

import { Button } from "@kit/ui/plugin";
import { EmailRefreshIcon } from "@/components/icons/MailActionIcons";
import { useInbox, useInboxState } from "@/context/InboxContext";
import { cn } from "@/lib/utils";

export type InboxEmptyStateVariant = "empty" | "error" | "search";

interface InboxEmptyStateProps {
  className?: string;
  /** Title override (e.g. an error heading). Defaults to "No messages". */
  title?: string;
  /** Subtitle override. Ignored while a fetch is in flight ("Syncing…"). */
  description?: string;
  /** Current folder, so the copy matches what the user is looking at. */
  folder?: string;
  /** What kind of nothing this is. */
  variant?: InboxEmptyStateVariant;
  /** Reason the load failed, shown for the error variant. */
  error?: string;
  /** Search term, shown for the search variant. */
  searchTerm?: string;
  /** Retry handler for the error variant. Falls back to a folder refresh. */
  onRetry?: () => void;
}

/** Folders PressedMail keeps locally: there is no server to fetch them from. */
const LOCAL_FOLDERS = new Set(["snoozed", "scheduled"]);

function isLocalFolder(folder?: string): boolean {
  return LOCAL_FOLDERS.has((folder ?? "").trim().toLowerCase());
}

/**
 * Shared empty-state for the message list across every layout variant.
 *
 * The copy follows the folder, because "This folder is empty · Get emails" was
 * wrong nearly everywhere it appeared: Snoozed and Scheduled hold local queues
 * with nothing to fetch, a search that matched nothing is not an empty folder,
 * and a failed load is not an empty folder either. That last one was the worst
 * of them: people were told their mail was gone when the server had simply not
 * answered.
 */
export const InboxEmptyState = memo(function InboxEmptyState({
  className,
  title,
  description,
  folder,
  variant = "empty",
  error,
  searchTerm,
  onRetry,
}: InboxEmptyStateProps) {
  // Straight from the inbox: useMailOperations only forwards this refresh and
  // reports the same isLoading twice, and reaching it required a composer
  // provider that an empty message list has no business needing.
  const { refreshMessages } = useInbox();
  const { isLoading: busy } = useInboxState();
  const normalizedFolder = (folder ?? "").trim().toLowerCase();
  const isError = variant === "error";

  const copy = (() => {
    if (isError) {
      return {
        Icon: AlertCircle,
        title: title ?? __("We could not load this folder", "pressedmail"),
        description:
          error ??
          description ??
          __("Check your connection and try again.", "pressedmail"),
      };
    }

    if (variant === "search") {
      return {
        Icon: SearchX,
        title: title ?? __("No results", "pressedmail"),
        description:
          description ??
          (searchTerm
            ? sprintf(
                /* translators: %s: the search term. */
                __("No messages match %s.", "pressedmail"),
                searchTerm,
              )
            : __("No messages match this search.", "pressedmail")),
      };
    }

    if (normalizedFolder === "snoozed") {
      return {
        Icon: Clock,
        title: title ?? __("Nothing snoozed", "pressedmail"),
        description:
          description ??
          __(
            "Snooze a message and it waits here until the time you pick.",
            "pressedmail",
          ),
      };
    }

    if (normalizedFolder === "scheduled") {
      return {
        Icon: SendHorizonal,
        title: title ?? __("Nothing scheduled", "pressedmail"),
        description:
          description ??
          __("Messages you schedule to send later wait here.", "pressedmail"),
      };
    }

    return {
      Icon: Inbox,
      title: title ?? __("No messages", "pressedmail"),
      description: description ?? __("This folder is empty", "pressedmail"),
    };
  })();

  // Fetching makes sense for one case only: a real mailbox folder that came
  // back empty. Not for a local queue with no server behind it, not for a
  // search that matched nothing, and not for a load that failed.
  const showRefresh = variant === "empty" && !isLocalFolder(normalizedFolder);
  const Icon = copy.Icon;

  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-3 p-8 text-center",
        className,
      )}
      // The e2e suite addresses a failed load and an empty folder separately,
      // because they are separate things.
      data-test={isError ? "inbox-error" : "inbox-empty"}
      data-testid={isError ? "inbox-error" : "inbox-empty"}
      data-variant={variant}
      role={isError ? "alert" : undefined}>
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full",
          isError ? "bg-destructive/10" : "bg-muted",
        )}>
        <Icon
          className={cn(
            "h-6 w-6",
            isError ? "text-destructive" : "text-muted-foreground",
          )}
          aria-hidden="true"
        />
      </div>
      <div className="space-y-1">
        <h3 className="font-medium text-sm">{copy.title}</h3>
        <p className="text-xs text-muted-foreground">
          {busy && !isError ? __("Syncing…", "pressedmail") : copy.description}
        </p>
      </div>
      {isError ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => (onRetry ? onRetry() : void refreshMessages())}
          className="h-7 text-xs"
          data-test="empty-state-retry">
          {__("Try again", "pressedmail")}
        </Button>
      ) : showRefresh ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refreshMessages()}
          disabled={busy}
          className="h-7 text-xs"
          data-test="empty-state-refresh">
          <EmailRefreshIcon
            className={cn("h-3 w-3 mr-1", busy && "animate-spin")}
            aria-hidden="true"
          />
          {busy
            ? __("Syncing…", "pressedmail")
            : __("Get emails", "pressedmail")}
        </Button>
      ) : null}
    </div>
  );
});

export default InboxEmptyState;
