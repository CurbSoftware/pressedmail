import { getMessageIdentityKey } from "@/lib/message-identity";
import { cn } from "@/lib/utils";
import type { EmailMessage } from "@/types";
import { PhishingIndicator } from "@/components/phishing/PhishingIndicator";

import { EmailSummaryButton } from "./EmailSummaryButton";
import { ThreadCountBadge } from "./ThreadCountBadge";

interface EmailListStatusSlotsProps {
  message: EmailMessage;
  threadCount?: number;
  slotClassName?: string;
  summaryClassName?: string;
  phishingClassName?: string;
}

export function EmailListStatusSlots({
  message,
  threadCount,
  slotClassName = "h-6 w-6",
  summaryClassName = "h-6 w-6",
  phishingClassName = "h-6",
}: EmailListStatusSlotsProps) {
  return (
    <span
      data-testid="message-ai-status-slots"
      data-test="message-ai-status-slots"
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
      <span
        data-test="message-summary-status-slot"
        data-testid="message-summary-status-slot"
        className={cn(
          "inline-flex shrink-0 items-center justify-center",
          slotClassName,
        )}>
        <EmailSummaryButton message={message} className={summaryClassName} />
      </span>
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
            className={phishingClassName}
          />
        </span>
      )}
    </span>
  );
}

export default EmailListStatusSlots;
