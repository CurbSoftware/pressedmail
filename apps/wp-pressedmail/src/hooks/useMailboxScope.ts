/**
 * React access to the canonical {@link MailboxScope}.
 *
 * Reads the raw scope inputs from the app/inbox contexts and memoizes the pure
 * {@link resolveMailboxScope}. This is the single seam layouts should use to ask
 * "what mailbox am I in" instead of re-deriving `selectedAccount === "all"` and
 * the effective account ids ad-hoc.
 */
import { useMemo } from "react";

import { useAppContext } from "@/context/AppProvider";
import { useCombinedAccountIds } from "@/hooks/useCombinedAccountIds";
import { useInbox } from "@/context/InboxContext";
import { useLayout } from "@/components/layouts";
import {
  type MailboxScope,
  resolveMailboxScope,
  serializeMailboxScope,
} from "@/lib/mailbox-scope";

export interface UseMailboxScopeResult {
  scope: MailboxScope;
  /** Folder-sensitive identity ({@link serializeMailboxScope}). */
  scopeKey: string;
  /** Account ids in scope (combined → all selected; single → that account). */
  accountIds: number[];
}

export function useMailboxScope(): UseMailboxScopeResult {
  const { accounts, selectedAccount, defaultAccountId } = useAppContext();
  const selectedConsolidatedAccountIds = useCombinedAccountIds();
  const { selectedFolder } = useInbox();
  const { currentLayout } = useLayout();

  return useMemo(() => {
    const scope = resolveMailboxScope(
      selectedAccount,
      selectedConsolidatedAccountIds,
      accounts,
      selectedFolder,
      defaultAccountId,
      currentLayout,
    );

    const accountIds =
      (!__SINGLE_MAILBOX__ && scope.type === "combined_inbox") ||
      scope.type === "virtual_view"
        ? scope.accountIds
        : scope.type === "account_inbox" || scope.type === "account_folder"
          ? [scope.accountId].filter((id) => id > 0)
          : [];

    return {
      scope,
      scopeKey: serializeMailboxScope(scope),
      accountIds,
    };
  }, [
    accounts,
    selectedAccount,
    selectedConsolidatedAccountIds,
    selectedFolder,
    defaultAccountId,
    currentLayout,
  ]);
}
