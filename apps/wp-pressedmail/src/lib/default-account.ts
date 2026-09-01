import type { EmailAccount } from "@/types";

function getNumericAccountId(account: EmailAccount): number | null {
  const id = Number(account.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isOwnedAccount(account: EmailAccount): boolean {
  return account.is_shared !== true;
}

export function resolveDefaultAccountId(
  accounts: EmailAccount[],
  preferredDefaultId?: number | string | null,
): number | null {
  const ownedIds = accounts
    .filter(isOwnedAccount)
    .map(getNumericAccountId)
    .filter((id): id is number => id !== null);

  if (ownedIds.length === 0) {
    return null;
  }

  const preferred = Number(preferredDefaultId);
  if (
    Number.isInteger(preferred) &&
    preferred > 0 &&
    ownedIds.includes(preferred)
  ) {
    return preferred;
  }

  const stampedDefault = accounts.find(
    (account) => isOwnedAccount(account) && account.is_default === true,
  );
  const stampedDefaultId = stampedDefault
    ? getNumericAccountId(stampedDefault)
    : null;

  if (stampedDefaultId !== null && ownedIds.includes(stampedDefaultId)) {
    return stampedDefaultId;
  }

  return ownedIds[0] ?? null;
}

export function isDefaultAccount(
  account: EmailAccount,
  defaultAccountId?: number | string | null,
): boolean {
  if (!isOwnedAccount(account)) {
    return false;
  }

  const accountId = getNumericAccountId(account);
  const defaultId = Number(defaultAccountId);

  return (
    accountId !== null &&
    Number.isInteger(defaultId) &&
    defaultId > 0 &&
    accountId === defaultId
  );
}

export function stampDefaultAccountState(
  accounts: EmailAccount[],
  preferredDefaultId?: number | string | null,
): { accounts: EmailAccount[]; defaultAccountId: number | null } {
  const defaultAccountId = resolveDefaultAccountId(
    accounts,
    preferredDefaultId,
  );

  let changed = false;
  const stampedAccounts = accounts.map((account) => {
    const nextIsDefault = isDefaultAccount(account, defaultAccountId);

    if (account.is_default === nextIsDefault) {
      return account;
    }

    changed = true;
    return {
      ...account,
      is_default: nextIsDefault,
    };
  });

  return {
    accounts: changed ? stampedAccounts : accounts,
    defaultAccountId,
  };
}
