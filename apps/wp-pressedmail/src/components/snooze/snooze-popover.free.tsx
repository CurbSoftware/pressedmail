import type { ReactNode } from "react";
import type { SnoozeTarget, SnoozeTargetCandidate } from "./snooze-target";

export type { SnoozeTarget, SnoozeTargetCandidate } from "./snooze-target";

interface SnoozePopoverProps {
  accountId?: number;
  messageUid?: string;
  onOpenChange?: (open: boolean) => void;
  folder?: string;
  sourceUidValidity?: string | number;
  sourceMessageId?: string;
  subject?: string;
  from?: string;
  date?: string;
  targets?: SnoozeTargetCandidate[];
  onPick?: (snoozeUntil: string) => Promise<boolean> | boolean;
  onSnoozed?: (succeeded: SnoozeTarget[]) => void;
  children: ReactNode;
}

export function SnoozePopover(_props: SnoozePopoverProps) {
  return null;
}
