import type { EmailAccount, EmailMessage } from "@/types";

/** A UID is meaningful only within this account, physical folder, and generation. */
export interface MessageIdentityRef {
  accountId: number;
  folder: string;
  uidValidity: string;
  uid: string;
}

export type ParsedAccountQualifiedToken =
  | (MessageIdentityRef & { kind: "message" })
  | {
      kind: "legacy-uid";
      accountId: number;
      legacyUid: string;
      uid?: never;
    }
  | {
      kind: "legacy-row";
      accountId: number;
      legacyRowId: string;
      uid?: never;
    };

function canonicalPositiveInteger(value: unknown): string | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }

  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isSafeInteger(numberValue) && String(numberValue) === value
    ? value
    : null;
}

/**
 * Validate an explicit reference without guessing a folder, generation, or UID.
 * Folder names are preserved exactly, including case, delimiters, and spaces.
 */
export function parseMessageIdentityRef(
  candidate: unknown,
): MessageIdentityRef | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const input = candidate as Record<string, unknown>;
  const accountId = canonicalPositiveInteger(input.accountId);
  const uidValidity = canonicalPositiveInteger(input.uidValidity);
  const uid = canonicalPositiveInteger(input.uid);
  const folder = input.folder;

  if (
    accountId === null ||
    uidValidity === null ||
    uid === null ||
    Number(uidValidity) > 4294967295 ||
    Number(uid) > 4294967295 ||
    typeof folder !== "string" ||
    folder === "" ||
    folder.includes("\0")
  ) {
    return null;
  }

  return { accountId: Number(accountId), folder, uidValidity, uid };
}

/**
 * Read the message's explicit mailbox metadata. Derived consolidated tokens,
 * display labels, mirror row IDs, and sequence numbers cannot fill missing data.
 */
export function getMessageIdentityRef(
  message: EmailMessage | MessageIdentityRef | null,
  fallbackAccountId?: string | number | null,
): MessageIdentityRef | null {
  if (!message) return null;

  const legacyUidValidity =
    "uid_validity" in message ? message.uid_validity : undefined;
  const uidValidity = message.uidValidity ?? legacyUidValidity;
  if (
    message.uidValidity != null &&
    legacyUidValidity != null &&
    canonicalPositiveInteger(message.uidValidity) !==
      canonicalPositiveInteger(legacyUidValidity)
  ) {
    return null;
  }

  return parseMessageIdentityRef({
    accountId: message.accountId ?? fallbackAccountId,
    folder: message.folder,
    uidValidity,
    uid: message.uid,
  });
}

function serializeMessageIdentity(ref: MessageIdentityRef): string {
  return JSON.stringify([ref.accountId, ref.folder, ref.uidValidity, ref.uid]);
}

/** Complete operation identity, or an empty key when the row must be reloaded. */
export function getMessageIdentityKey(
  message: EmailMessage | MessageIdentityRef | null,
): string {
  const ref = getMessageIdentityRef(message);
  return ref ? serializeMessageIdentity(ref) : "";
}

/** UI rows use the same mailbox identity as selection and operations. */
export function getMessageRowIdentityKey(message: EmailMessage): string {
  return getMessageIdentityKey(message);
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
 * Complete operation token for bulk/sweep payloads. The optional account is
 * explicit single-account context; folder and generation must come from the row.
 */
export function getAccountQualifiedMessageToken(
  message: EmailMessage | MessageIdentityRef | null,
  fallbackAccountId?: string | number | null,
): string {
  const ref = getMessageIdentityRef(message, fallbackAccountId);
  return ref ? serializeMessageIdentity(ref) : "";
}

/**
 * Parse complete tuples, accepting equivalent JSON escaping and whitespace.
 * Encoding always uses the canonical tuple representation.
 * Legacy values deliberately have no `uid` field: callers must resolve a unique
 * loaded complete reference or request a reload before making an operation.
 */
export function parseAccountQualifiedToken(
  token: string,
): ParsedAccountQualifiedToken | null {
  if (typeof token !== "string") return null;

  if (token.trimStart().startsWith("[")) {
    try {
      const tuple: unknown = JSON.parse(token);
      if (
        !Array.isArray(tuple) ||
        tuple.length !== 4 ||
        typeof tuple[0] !== "number" ||
        typeof tuple[1] !== "string" ||
        typeof tuple[2] !== "string" ||
        typeof tuple[3] !== "string"
      ) {
        return null;
      }

      const ref = parseMessageIdentityRef({
        accountId: tuple[0],
        folder: tuple[1],
        uidValidity: tuple[2],
        uid: tuple[3],
      });
      return ref ? { kind: "message", ...ref } : null;
    } catch {
      return null;
    }
  }

  const legacy = /^([1-9][0-9]*):(id:)?([1-9][0-9]*)$/.exec(token);
  if (!legacy || legacy[0] !== token) return null;
  const accountId = canonicalPositiveInteger(legacy[1]);
  const identifier = canonicalPositiveInteger(legacy[3]);
  if (accountId === null || identifier === null) return null;

  if (legacy[2]) {
    return {
      kind: "legacy-row",
      accountId: Number(accountId),
      legacyRowId: identifier,
    };
  }
  return {
    kind: "legacy-uid",
    accountId: Number(accountId),
    legacyUid: identifier,
  };
}

/**
 * Raw provider identifier for existing wire contracts, never a safe cache or
 * operation identity by itself. Mutations must also carry a complete reference.
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
