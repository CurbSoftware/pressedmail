import type { EmailAccount } from "@/types";

/**
 * Free build stand-in for account-badge-control.tsx. The badge editor names
 * accounts in the combined inbox, and a single-mailbox build has none. The
 * connections card already skips it behind `__SINGLE_MAILBOX__`; this twin makes
 * the public Free source say the same, because the source export keeps every
 * module a Free file imports by name, whether or not the bundle used it.
 */
export function AccountBadgeControl(_props: { account: EmailAccount }): null {
  return null;
}
