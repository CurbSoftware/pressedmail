/**
 * Window event for the 409 CREDENTIALS_REQUIRED conflict. The account has no
 * usable stored mailbox secret (never entered, or cleared by the lock's
 * clear-on-logout). The api-client dispatches it from the fetch layer; the
 * connection-state service listens and records it per account so the
 * connection banner surfaces a persistent "update credentials" prompt.
 *
 * Lives in its own dependency-free module (rather than api-client) so modules
 * on both sides of the api-client boundary can share the constant without an
 * import cycle, and so suites that `vi.mock("@/lib/api-client")` don't have
 * to know about it.
 */
export const CREDENTIALS_REQUIRED_EVENT = "pressedmail:credentials-required";

export interface CredentialsRequiredDetail {
  /** Mailbox account the conflict names, when the response carried one. */
  accountId: number | null;
  /** User-facing recovery guidance from the server. */
  message: string;
}

/** Server copy reused when a 409 arrives without a usable message. */
export const CREDENTIALS_REQUIRED_FALLBACK_MESSAGE =
  "Reconnect the account or re-enter the mailbox password to continue.";

export function dispatchCredentialsRequired(
  detail: CredentialsRequiredDetail,
): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<CredentialsRequiredDetail>(CREDENTIALS_REQUIRED_EVENT, {
      detail,
    }),
  );
}

export function subscribeCredentialsRequired(
  listener: (detail: CredentialsRequiredDetail | undefined) => void,
): () => void {
  const handleEvent = (event: Event) => {
    listener((event as CustomEvent<CredentialsRequiredDetail>).detail);
  };
  window.addEventListener(CREDENTIALS_REQUIRED_EVENT, handleEvent);
  return () => {
    window.removeEventListener(CREDENTIALS_REQUIRED_EVENT, handleEvent);
  };
}
