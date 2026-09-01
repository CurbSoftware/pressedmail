import type { EmailAccount, EmailMessage } from "@/types";

function stringifyIdentityPart(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value);
}

/**
 * Stable operation identity for a message across inbox modes.
 */
export function getMessageIdentityKey(message: EmailMessage | null): string {
  if (!message) return "";

  return stringifyIdentityPart(
    message.consolidatedUid ??
      message.uid ??
      message.id ??
      message.msg_no ??
      "",
  );
}

/**
 * UI row identity scoped enough for React keys in folder/account message lists.
 */
export function getMessageRowIdentityKey(message: EmailMessage): string {
  const account = stringifyIdentityPart(
    message.accountId ?? message.accountEmail ?? "",
  );
  const folder = stringifyIdentityPart(
    message.folder ?? message.folderLabel ?? "",
  );
  const messageId = stringifyIdentityPart(
    message.consolidatedUid ??
      message.uid ??
      message.messageId ??
      message.id ??
      message.msg_no ??
      "",
  );

  return `account:${account}|folder:${folder}|message:${messageId}`;
}

/**
 * Generate React keys for a message list. The identity should already be
 * unique; the suffix only protects against truly duplicated backend rows.
 */
export function getMessageListRowKeys(messages: EmailMessage[]): string[] {
  const seen = new Map<string, number>();

  return messages.map((message) => {
    const key = getMessageRowIdentityKey(message);
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);

    return count === 1 ? key : `${key}|row:${count}`;
  });
}

/**
 * Account-qualified operation token for bulk/sweep payloads.
 *
 * Multi-account scopes must never send bare numeric ids. A bare number can
 * collide with another account's uid OR mirror-row id. Forms:
 *  - "<accountId>:<uid>"        when the row has a UID
 *  - "<accountId>:id:<rowId>"   when it only has a mirror-row id
 * Falls back to the plain identity key when the account is unknown
 * (single-account flows keep working with legacy tokens).
 */
export function getAccountQualifiedMessageToken(
  message: EmailMessage | null,
  fallbackAccountId?: string | number | null,
): string {
  if (!message) return "";

  const consolidated = stringifyIdentityPart(message.consolidatedUid ?? "");
  if (consolidated !== "") {
    return consolidated;
  }

  const accountId = Number(message.accountId ?? fallbackAccountId ?? 0);
  if (!Number.isFinite(accountId) || accountId <= 0) {
    return getMessageIdentityKey(message);
  }

  const uid = stringifyIdentityPart(message.uid ?? "");
  if (uid !== "") {
    return `${accountId}:${uid}`;
  }

  const rowId = stringifyIdentityPart(message.id ?? "");
  if (rowId !== "") {
    return `${accountId}:id:${rowId}`;
  }

  return getMessageIdentityKey(message);
}

/** Parsed account-qualified token (see getAccountQualifiedMessageToken). */
export function parseAccountQualifiedToken(
  token: string,
): { accountId: number; uid?: string; rowId?: string } | null {
  const rowForm = /^(\d+):id:(\d+)$/.exec(token);
  if (rowForm) {
    return { accountId: Number(rowForm[1]), rowId: rowForm[2] };
  }
  const uidForm = /^(\d+):(\d+)$/.exec(token);
  if (uidForm) {
    return { accountId: Number(uidForm[1]), uid: uidForm[2] };
  }
  return null;
}

/**
 * The message identifier used for API requests and result caching.
 *
 * Lived in `lib/phishing-email.ts` until the edition split needed it: shared
 * inbox components use it regardless of edition, so keeping it in a phishing
 * module dragged the phishing surface into the Free bundle.
 */
export function getMessageRequestId(message: EmailMessage | null): string {
  if (!message) return "";

  return String(message.uid ?? message.msg_no ?? message.id ?? "");
}

/**
 * Resolve the account a message belongs to, falling back to the selected
 * account. Generic inbox plumbing; see `getMessageRequestId` for why it moved.
 */
export function resolveMessageAccountId(
  message: EmailMessage | null,
  accounts: EmailAccount[],
  selectedAccount: string | null,
): number | null {
  if (message?.accountId) {
    return Number(message.accountId);
  }

  if (!selectedAccount) {
    return null;
  }

  const account = accounts.find((item) => item.email === selectedAccount);
  return account?.id ? Number(account.id) : null;
}
