"use client";

import { useContext, useEffect, useRef } from "react";

import { useEmailSelection } from "@/context/selection";
import { InboxContext } from "@/context/InboxContext";
import { useMailboxScope } from "@/hooks/useMailboxScope";
import { getMessageFilterSignature } from "@/lib/message-filter-signature";

/**
 * Clears bulk multi-selection whenever the mailbox scope OR the active filters
 * change (account switch, combined toggle, folder/view change, filter/search
 * change). A selection that survives a filter change keeps ids that no longer
 * match the view and reports them as bulk-operation failures.
 *
 * Mount once inside each EmailSelectionProvider subtree. Renders nothing.
 */
export function ScopeChangeSelectionReset() {
  const { scopeKey } = useMailboxScope();
  // Optional read: this component also mounts in shells (and tests) without a
  // full InboxProvider, where there are no filters to watch.
  const inbox = useContext(InboxContext);
  const { deselectAll } = useEmailSelection();
  const filterSignature = getMessageFilterSignature(
    inbox?.activeFilters ?? {},
  );
  const resetKey = `${scopeKey}|${filterSignature}`;
  const previousResetKey = useRef(resetKey);

  useEffect(() => {
    if (previousResetKey.current !== resetKey) {
      previousResetKey.current = resetKey;
      deselectAll();
    }
  }, [resetKey, deselectAll]);

  return null;
}

export default ScopeChangeSelectionReset;
