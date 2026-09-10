"use client";

import { useContext, useEffect, useRef } from "react";

import { useEmailSelection } from "@/context/selection";
import { InboxContext } from "@/context/InboxContext";
import { useMailboxScope } from "@/hooks/useMailboxScope";
import { getMessageFilterSignature } from "@/lib/message-filter-signature";
import { getMessageIdentityRef } from "@/lib/message-identity";

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
  const filterSignature = getMessageFilterSignature(inbox?.activeFilters ?? {});
  const resetKey = `${scopeKey}|${filterSignature}`;
  const previousResetKey = useRef(resetKey);
  const generations = useRef(new Map<string, string>());

  useEffect(() => {
    let reset = false;
    if (previousResetKey.current !== resetKey) {
      previousResetKey.current = resetKey;
      generations.current.clear();
      reset = true;
    }
    for (const message of inbox?.messages ?? []) {
      const ref = getMessageIdentityRef(message);
      if (!ref) continue;
      const folderKey = JSON.stringify([ref.accountId, ref.folder]);
      const previous = generations.current.get(folderKey);
      if (previous !== undefined && previous !== ref.uidValidity) reset = true;
      generations.current.set(folderKey, ref.uidValidity);
    }
    if (reset) deselectAll();
  }, [resetKey, deselectAll, inbox?.messages]);

  return null;
}

export default ScopeChangeSelectionReset;
