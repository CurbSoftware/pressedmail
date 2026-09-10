import type { EmailMessage } from "@/types";
import {
  getMessageIdentityRef,
  parseAccountQualifiedToken,
  parseMessageIdentityRef,
  type MessageIdentityRef,
} from "./message-identity";

export type ConsolidatedKey = MessageIdentityRef;

export type LegacyMessageMatchScope = Pick<
  MessageIdentityRef,
  "accountId" | "folder" | "uidValidity"
>;

/** Incomplete rows cannot provide a safe mailbox identity. */
export function deriveConsolidatedKey(
  message: EmailMessage,
): ConsolidatedKey | null {
  return getMessageIdentityRef(message);
}

export function consolidatedKeysMatch(a: unknown, b: unknown): boolean {
  const first = parseMessageIdentityRef(a);
  const second = parseMessageIdentityRef(b);
  return Boolean(
    first &&
    second &&
    first.accountId === second.accountId &&
    first.folder === second.folder &&
    first.uidValidity === second.uidValidity &&
    first.uid === second.uid,
  );
}

/**
 * Full tokens match all four mailbox identity fields. Legacy lookups require
 * explicit scope captured with the candidate, never guessed from the row or
 * current view. Bare numbers are UIDs; mirror IDs require account:id:rowId.
 */
export function matchesMessageById(
  message: EmailMessage,
  candidateId: string | number,
  legacyScope?: LegacyMessageMatchScope,
): boolean {
  const messageRef = deriveConsolidatedKey(message);
  if (!messageRef) return false;

  const parsed = parseAccountQualifiedToken(String(candidateId));
  if (parsed?.kind === "message") {
    return consolidatedKeysMatch(messageRef, parsed);
  }

  if (!legacyScope) return false;
  if (parsed && parsed.accountId !== messageRef.accountId) return false;

  if (parsed?.kind === "legacy-row") {
    const scopedMessage = parseMessageIdentityRef({
      ...legacyScope,
      uid: messageRef.uid,
    });
    const rowId = parseMessageIdentityRef({
      ...legacyScope,
      uid: message.id,
    })?.uid;
    return (
      consolidatedKeysMatch(messageRef, scopedMessage) &&
      rowId === parsed.legacyRowId
    );
  }

  const candidateRef = parseMessageIdentityRef({
    ...legacyScope,
    uid: parsed?.kind === "legacy-uid" ? parsed.legacyUid : candidateId,
  });
  return consolidatedKeysMatch(messageRef, candidateRef);
}
