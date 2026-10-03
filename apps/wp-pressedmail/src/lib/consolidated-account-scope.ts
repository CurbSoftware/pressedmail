import type { EmailAccount } from "@/types";

export const CONSOLIDATED_ACCOUNT_SCOPE_PREFIX = "all";

export function normalizeConsolidatedAccountIds(accountIds: unknown): number[] {
  if (!Array.isArray(accountIds)) {
    return [];
  }

  const normalized = accountIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  return Array.from(new Set(normalized));
}

export function getAccountNumericId(account: EmailAccount): number | null {
  const id = Number(account.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Mailboxes the combined inbox may include: the user's own, never shared ones. */
export function getAvailableAccountIds(accounts: EmailAccount[]): number[] {
  return accounts
    .filter((account) => !account.share)
    .map(getAccountNumericId)
    .filter((id): id is number => id !== null);
}

export function getEffectiveConsolidatedAccountIds(
  accounts: EmailAccount[],
  selectedAccountIds: unknown,
  defaultAccountId?: number | string | null,
): number[] {
  const availableIds = getAvailableAccountIds(accounts);
  const selectedIds = normalizeConsolidatedAccountIds(selectedAccountIds);

  if (selectedIds.length === 0) {
    // No explicit combined-inbox selection: open the user's single default
    // account when there is a valid one, otherwise fall back to all accounts
    // (brand-new/edge state with no default pointer yet).
    const normalizedDefault = Number(defaultAccountId);
    if (
      Number.isInteger(normalizedDefault) &&
      normalizedDefault > 0 &&
      availableIds.includes(normalizedDefault)
    ) {
      return [normalizedDefault];
    }

    return availableIds;
  }

  const available = new Set(availableIds);
  return selectedIds.filter((id) => available.has(id));
}

export function getEffectiveConsolidatedAccountIdsForLayout(
  accounts: EmailAccount[],
  selectedAccountIds: unknown,
  defaultAccountId: number | string | null | undefined,
  layoutId: string,
): number[] {
  // PressedOut is a Pro layout; Free compiles only the selection path.
  return !__IS_FREE__ && layoutId === "pressedout"
    ? getAvailableAccountIds(accounts)
    : getEffectiveConsolidatedAccountIds(
        accounts,
        selectedAccountIds,
        defaultAccountId,
      );
}

export function serializeConsolidatedAccountIds(
  accountIds: unknown,
): string | undefined {
  const normalized = normalizeConsolidatedAccountIds(accountIds).sort(
    (left, right) => left - right,
  );

  return normalized.length > 0 ? normalized.join(",") : undefined;
}

export function buildConsolidatedAccountScopeKey(accountIds: unknown): string {
  const serialized = serializeConsolidatedAccountIds(accountIds);
  return serialized
    ? `${CONSOLIDATED_ACCOUNT_SCOPE_PREFIX}:${serialized}`
    : CONSOLIDATED_ACCOUNT_SCOPE_PREFIX;
}

export function accountIdSetEquals(left: unknown, right: unknown): boolean {
  const leftIds = normalizeConsolidatedAccountIds(left).sort((a, b) => a - b);
  const rightIds = normalizeConsolidatedAccountIds(right).sort((a, b) => a - b);

  if (leftIds.length !== rightIds.length) {
    return false;
  }

  return leftIds.every((id, index) => id === rightIds[index]);
}
