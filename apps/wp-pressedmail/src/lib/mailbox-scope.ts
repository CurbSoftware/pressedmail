/**
 * Canonical mailbox-scope model.
 *
 * A single, pure interpretation of "what mailbox am I looking at" shared by the
 * three inbox layouts (default/pressedm, pressedg, pressedout). It wraps the
 * existing {@link ./consolidated-account-scope} helpers so account-id
 * normalization and the combined scope key stay defined in exactly one place.
 *
 * Pure and total: {@link resolveMailboxScope} never throws and has no React
 * dependency. Layout code reads it through {@link ../hooks/useMailboxScope}.
 */
import type { EmailAccount } from "@/types";

import {
  CONSOLIDATED_ACCOUNT_SCOPE_PREFIX,
  buildConsolidatedAccountScopeKey,
  getAccountNumericId,
  getEffectiveConsolidatedAccountIdsForLayout,
} from "@/lib/consolidated-account-scope";

/** Virtual nav views that aggregate messages by flag rather than by IMAP folder. */
export const MAILBOX_VIRTUAL_VIEWS = [
  "important",
  "starred",
  "snoozed",
  "scheduled",
] as const;

export type MailboxVirtualView = (typeof MAILBOX_VIRTUAL_VIEWS)[number];

export type MailboxScope =
  | {
      type: "combined_inbox";
      /** Effective, access-filtered account ids included in the combined view. */
      accountIds: number[];
      /** Active nav folder within the combined view (almost always "INBOX"). */
      folder: string;
      /**
       * Account-scope key, byte-identical to the legacy
       * `buildConsolidatedAccountScopeKey(effectiveConsolidatedAccountIds)`
       * (e.g. "all:2,5"). Intentionally folder-independent so it remains a
       * drop-in for the existing consolidated request key. Use
       * {@link serializeMailboxScope} when a folder-sensitive identity is needed.
       */
      scopeKey: string;
    }
  | {
      type: "account_inbox";
      accountId: number;
      accountEmail: string;
      scopeKey: string;
    }
  | {
      type: "account_folder";
      accountId: number;
      accountEmail: string;
      folder: string;
      scopeKey: string;
    }
  | {
      type: "virtual_view";
      view: MailboxVirtualView;
      accountId: number | null;
      accountEmail: string | null;
      accountIds: number[];
      scopeKey: string;
    };

function isVirtualView(folder: string): folder is MailboxVirtualView {
  return (MAILBOX_VIRTUAL_VIEWS as readonly string[]).includes(folder);
}

/**
 * Resolve the current mailbox scope from raw app/inbox state. Pure and total.
 *
 * `selectedAccount === "all"` ({@link CONSOLIDATED_ACCOUNT_SCOPE_PREFIX}) always
 * yields a `combined_inbox` scope (matching the legacy consolidated-mode check),
 * regardless of the active folder. With no explicit combined selection the scope
 * narrows to `defaultAccountId` when it is a valid account, otherwise it falls
 * back to all accounts. Single-account state is classified by folder: a virtual
 * nav id → `virtual_view`, "INBOX" → `account_inbox`, anything else →
 * `account_folder`.
 */
export function resolveMailboxScope(
  selectedAccount: string | null | undefined,
  selectedConsolidatedAccountIds: unknown,
  accounts: EmailAccount[],
  selectedFolder: string | null | undefined,
  defaultAccountId?: number | string | null,
  layoutId = "pressedm",
): MailboxScope {
  const folder = (selectedFolder ?? "").trim() || "INBOX";

  if (selectedAccount === CONSOLIDATED_ACCOUNT_SCOPE_PREFIX) {
    const accountIds = getEffectiveConsolidatedAccountIdsForLayout(
      accounts,
      selectedConsolidatedAccountIds,
      defaultAccountId,
      layoutId,
    );
    return {
      type: "combined_inbox",
      accountIds,
      folder,
      scopeKey: buildConsolidatedAccountScopeKey(accountIds),
    };
  }

  const email = selectedAccount ?? "";
  const account = accounts.find((acc) => acc.email?.toString() === email);
  const accountId = account ? getAccountNumericId(account) : null;
  const normalizedFolder = folder.toLowerCase();
  const keyEmail = email || "?";

  if (isVirtualView(normalizedFolder)) {
    return {
      type: "virtual_view",
      view: normalizedFolder,
      accountId,
      accountEmail: email || null,
      accountIds: accountId !== null ? [accountId] : [],
      scopeKey: `${keyEmail}:view:${normalizedFolder}`,
    };
  }

  if (normalizedFolder === "inbox") {
    return {
      type: "account_inbox",
      accountId: accountId ?? 0,
      accountEmail: email,
      scopeKey: `${keyEmail}:INBOX`,
    };
  }

  return {
    type: "account_folder",
    accountId: accountId ?? 0,
    accountEmail: email,
    folder,
    scopeKey: `${keyEmail}:${folder}`,
  };
}

/**
 * Stable, folder-sensitive identity for a scope. Use this (not `scope.scopeKey`)
 * when a change should be observed on folder/view switches too, e.g. clearing
 * bulk selection. Order-independent for combined scopes (the underlying account
 * scope key is sorted).
 */
export function serializeMailboxScope(scope: MailboxScope): string {
  switch (scope.type) {
    case "combined_inbox":
      return scope.folder.toUpperCase() === "INBOX"
        ? scope.scopeKey
        : `${scope.scopeKey}:${scope.folder.toLowerCase()}`;
    case "account_inbox":
    case "account_folder":
    case "virtual_view":
      return scope.scopeKey;
  }
}

export function isCombinedInboxScope(
  scope: MailboxScope,
): scope is Extract<MailboxScope, { type: "combined_inbox" }> {
  return scope.type === "combined_inbox";
}


