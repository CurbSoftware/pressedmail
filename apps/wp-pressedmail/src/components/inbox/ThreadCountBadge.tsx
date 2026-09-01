import { __, sprintf } from "@wordpress/i18n";
import { Layers } from "lucide-react";

import { Badge, cn } from "@kit/ui/plugin";

interface ThreadCountBadgeProps {
  /** Total messages in the thread. The badge only renders when this is > 1. */
  count?: number;
  className?: string;
}

/**
 * Compact indicator shown on the latest row of an expanded inbox thread.
 * Renders the conversation's message count; hidden for single-message threads
 * (count <= 1).
 */
export function ThreadCountBadge({ count, className }: ThreadCountBadgeProps) {
  if (!count || count <= 1) {
    return null;
  }

  const label = sprintf(
    /* translators: %d: number of messages in the conversation. */
    __("%d messages in conversation", "pressedmail"),
    count,
  );

  return (
    <Badge
      variant="secondary"
      data-test="thread-count-badge"
      data-testid="thread-count-badge"
      className={cn(
        "inline-flex h-4 shrink-0 items-center gap-0.5 px-1 py-0 text-[10px] font-medium",
        className,
      )}
      title={label}
      aria-label={label}>
      <Layers className="h-2.5 w-2.5" aria-hidden="true" />
      {count}
    </Badge>
  );
}

export default ThreadCountBadge;
