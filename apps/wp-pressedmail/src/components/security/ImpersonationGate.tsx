import type { ReactNode } from "react";

import { getImpersonationState } from "@/lib/impersonation";
import { ImpersonationBlockedNotice } from "./ImpersonationBlockedNotice";

interface ImpersonationGateProps {
  children: ReactNode;
}

/**
 * Boot gate that sits ABOVE the data-provider tree.
 *
 * When the injected status says access is blocked (admin user-switching /
 * impersonation), it short-circuits to a graceful notice so NONE of the feature
 * providers mount. No accounts/folders/messages/calendar/settings requests
 * fire, and the user sees one clear message instead of a cascade of errors.
 *
 * The signal is synchronous (injected at page render; user-switching reloads
 * the page), so there is no loading flash and no extra round-trip. It fails open
 * Anything short of an explicit denial renders the app normally.
 */
export function ImpersonationGate({ children }: ImpersonationGateProps) {
  const state = getImpersonationState();

  if (state.blocked) {
    return (
      <ImpersonationBlockedNotice
        message={state.message}
        reason={state.reason}
      />
    );
  }

  return <>{children}</>;
}

export default ImpersonationGate;
