import { getMessageIdentityKey } from "@/lib/message-identity";
import { cn } from "@/lib/utils";
import type { EmailMessage } from "@/types";
import { PhishingIndicator } from "@/components/phishing/PhishingIndicator";
import { SpamIndicator } from "@/components/spam";

import { BulkActionStatusIndicator } from "./BulkActionStatusIndicator";
import { EmailSummaryButton } from "./EmailSummaryButton";
import { ThreadCountBadge } from "./ThreadCountBadge";

interface EmailListStatusSlotsProps {
  message: EmailMessage;
  threadCount?: number;
  /** Dense rows use the smaller slots. */
  compact?: boolean;
}

export function EmailListStatusSlots({
  message,
  threadCount,
  compact = false,
}: EmailListStatusSlotsProps) {
  const slotClassName = compact ? "h-5 w-5" : "h-6 w-6";
  return (
    <span
      // The slots hold Pro AI indicators, so only Pro names them for tests.
      data-testid={__IS_FREE__ ? undefined : "message-ai-status-slots"}
      data-test={__IS_FREE__ ? undefined : "message-ai-status-slots"}
      className="inline-flex h-6 items-center justify-end gap-1">
      {threadCount ? (
        <span
          data-test="message-thread-count-slot"
          data-testid="message-thread-count-slot"
          className={cn(
            "inline-flex shrink-0 items-center justify-center",
            slotClassName,
          )}>
          <ThreadCountBadge count={threadCount} />
        </span>
      ) : null}
      {__ENABLE_AI_SUMMARIZE__ && (
        <span
          data-test="message-summary-status-slot"
          data-testid="message-summary-status-slot"
          className={cn(
            "inline-flex shrink-0 items-center justify-center",
            slotClassName,
          )}>
          <EmailSummaryButton message={message} className={slotClassName} />
        </span>
      )}
      {/* The spam mark sits left of the phishing slot on purpose. Reports
          visibility controls both marks for all completed scans. The
          phishing slot keeps its width even when it is empty, which holds the
          fish, whenever it appears, in one column at the right edge of every
          row, and a bag with no fish beside it in the column to its left. A
          spam mark used to sit to the fish's right and push it left on exactly
          the rows that were flagged, and a lone bag drifted into the fish's
          column. The spam slot has no width of its own: a row with no spam
          mark has no spam slot at all. */}
      {__ENABLE_SPAM_DETECTION__ && (
        <span
          data-test="message-spam-status-slot"
          data-testid="message-spam-status-slot"
          className={cn(
            "inline-flex shrink-0 items-center justify-center empty:hidden",
            slotClassName,
          )}>
          <SpamIndicator
            messageId={getMessageIdentityKey(message)}
            className={compact ? "h-5" : "h-6"}
          />
        </span>
      )}
      {__ENABLE_PHISHING_DETECTION__ && (
        <span
          data-test="message-phishing-status-slot"
          data-testid="message-phishing-status-slot"
          className={cn(
            "inline-flex shrink-0 items-center justify-center",
            slotClassName,
          )}>
          <PhishingIndicator
            messageId={getMessageIdentityKey(message)}
            className={compact ? "h-5" : "h-6"}
          />
        </span>
      )}
      {/* Bulk mutations exist in both editions, so this slot is not behind a
          feature define. It renders nothing until a bulk action runs. */}
      <span
        data-test="message-bulk-action-status-slot"
        data-testid="message-bulk-action-status-slot"
        className={cn(
          "inline-flex shrink-0 items-center justify-center empty:hidden",
          slotClassName,
        )}>
        <BulkActionStatusIndicator
          messageId={getMessageIdentityKey(message)}
          className={compact ? "h-5" : "h-6"}
        />
      </span>
    </span>
  );
}

export default EmailListStatusSlots;
