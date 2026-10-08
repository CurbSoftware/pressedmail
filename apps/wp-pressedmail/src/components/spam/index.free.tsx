/**
 * Free edition: spam checks are Pro (plan 8.1). Every export renders nothing
 * and the bulk hook reports itself unavailable, so shared components mount
 * these without a toast, placeholder or disabled control.
 */
import type { ReactNode } from "react";

const Nothing = (_props: Record<string, unknown>): null => null;

export const SpamIndicator = Nothing;
export const SpamResultBadge = Nothing;
export const SpamProtectActions = Nothing;
export const SecurityToolsPopover = Nothing;
export const SecurityToolsMenuItems = Nothing;
export const SpamSheetActions = Nothing;

const OFF = {
  available: false,
  bothAvailable: false,
  running: null,
  request: () => {},
  stop: () => {},
  dialogs: null as ReactNode,
};

export function useBulkSecurityCheck(_scope: Record<string, unknown>) {
  return OFF;
}
