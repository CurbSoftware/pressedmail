/**
 * Shared sweep-scope builder.
 *
 * One implementation of the scope the sweep dialog sends, previously
 * copy-pasted (and drifting) across BulkActionBar, the PressedG layout and the
 * mobile screen. The combined scope now also carries the per-account
 * `folderMap` so the server resolves each account's own source path instead of
 * guessing from one shared string.
 */

import { __, sprintf } from "@wordpress/i18n";

import {
  CONSOLIDATED_ACCOUNT_SCOPE_PREFIX,
  getEffectiveConsolidatedAccountIdsForLayout,
} from "@/lib/consolidated-account-scope";
import { getConsolidatedFolderMapForPath } from "@/lib/consolidated-folder-map";
import type { SweepScope } from "@/services/one-off-sweep.service";
import type { ImapFolder } from "@/services/interfaces";
import type { EmailAccount } from "@/types";

export interface BuildSweepScopeArgs {
  accounts: EmailAccount[];
  selectedAccount: string | null;
  selectedConsolidatedAccountIds: unknown;
  selectedFolder: string | null | undefined;
  currentFolderRole: string | null | undefined;
  folders: ImapFolder[];
  layoutId?: string;
}

function folderLabelForRole(
  folderRole: string | undefined,
  folderPath: string,
): string {
  if (folderRole === "inbox") return __("Inbox", "pressedmail");
  if (folderRole === "archive") return __("Archive", "pressedmail");
  if (folderRole === "spam" || folderRole === "junk") {
    return __("Junk", "pressedmail");
  }
  if (folderRole === "trash") return __("Trash", "pressedmail");
  return folderPath;
}

export function buildSweepScope(args: BuildSweepScopeArgs): SweepScope | null {
  const {
    accounts,
    selectedAccount,
    selectedConsolidatedAccountIds,
    selectedFolder,
    currentFolderRole,
    folders,
    layoutId = "pressedm",
  } = args;

  const folderPath = selectedFolder || "INBOX";
  const folderRole = currentFolderRole ?? undefined;
  const folderLabel = folderLabelForRole(folderRole, folderPath);
  const isConsolidated = selectedAccount === CONSOLIDATED_ACCOUNT_SCOPE_PREFIX;

  if (isConsolidated) {
    const accountIds = getEffectiveConsolidatedAccountIdsForLayout(
      accounts,
      selectedConsolidatedAccountIds,
      undefined,
      layoutId,
    );
    if (accountIds.length === 0) return null;

    return {
      kind: "combined_inbox",
      accountIds,
      folderPath,
      folderRole,
      folderMap: getConsolidatedFolderMapForPath(folders, folderPath),
      viewLabel:
        folderRole === "inbox"
          ? __("Combined Inbox", "pressedmail")
          : sprintf(
              /* translators: %s: folder name. */
              __("Combined %s", "pressedmail"),
              folderLabel,
            ),
    };
  }

  const account = accounts.find((item) => item.email === selectedAccount);
  const accountId = account?.id ? Number(account.id) : null;
  if (!accountId) return null;

  return {
    kind: "account_folder",
    accountIds: [accountId],
    folderPath,
    folderRole,
    viewLabel: sprintf(
      /* translators: %1$s: account email, %2$s: folder name. */
      __("%1$s %2$s", "pressedmail"),
      selectedAccount,
      folderLabel,
    ),
  };
}
