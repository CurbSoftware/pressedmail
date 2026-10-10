/**
 * Free edition: there are no spam or security checks (plan 8.1). Shared
 * components still call these, so each is an inert stand-in that renders or
 * does nothing and names no route.
 */
import type { ReactNode } from "react";

import type { EmailMessage } from "@/types";

export function SecurityProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// Only what shared components read; Pro-only callers never reach this stub. Moving mail out of Junk tells the site the sender
// is fine in Pro, and does nothing here: the Free edition has no checks to teach.
const OFF = { spamEnabled: false, rememberNotSpam: async (): Promise<void> => {} } as const;

export function useSecurity() {
  return OFF;
}

export function useMessageSecurityResults(_options: {
  message: EmailMessage | null;
  accountId: number | null;
  enabled?: boolean;
}): void {}
