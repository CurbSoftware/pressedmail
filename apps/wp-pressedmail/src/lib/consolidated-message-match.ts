import type { EmailMessage } from "@/types";

export interface ConsolidatedKey {
  accountId: string | null;
  folder: string | null;
  uid: string | null;
}

type KeyableMessage = Pick<
  EmailMessage,
  "accountId" | "folder" | "uid" | "consolidatedUid" | "id"
>;

function toStr(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

export function deriveConsolidatedKey(msg: KeyableMessage): ConsolidatedKey {
  const accountId = toStr(msg.accountId ?? null);
  const folder = toStr(msg.folder ?? null);
  const uid = toStr(msg.uid ?? null);

  if (uid) {
    return { accountId, folder, uid };
  }

  if (msg.consolidatedUid) {
    const raw = String(msg.consolidatedUid);
    const colonIdx = raw.indexOf(":");
    if (colonIdx > 0) {
      const head = raw.slice(0, colonIdx);
      const tail = raw.slice(colonIdx + 1);
      if (head && tail) {
        return { accountId: head, folder, uid: tail };
      }
    }
  }

  return { accountId: null, folder, uid: toStr(msg.id ?? null) };
}

export function consolidatedKeysMatch(
  a: ConsolidatedKey,
  b: ConsolidatedKey,
): boolean {
  if (!a.uid || !b.uid) return false;
  if (a.uid !== b.uid) return false;
  if (a.accountId && b.accountId && a.accountId !== b.accountId) return false;
  if (a.folder && b.folder && a.folder !== b.folder) return false;
  return true;
}

function parseCandidateKey(candidate: string): ConsolidatedKey | null {
  const rowKey = candidate.match(
    /^account:(.*?)\|folder:(.*?)\|message:(.*?)(?:\|row:\d+)?$/,
  );
  if (rowKey) {
    return {
      accountId: rowKey[1] ? rowKey[1] : null,
      folder: rowKey[2] ? rowKey[2] : null,
      uid: rowKey[3] ? rowKey[3] : null,
    };
  }

  const colonIdx = candidate.indexOf(":");
  if (colonIdx <= 0) return null;
  const head = candidate.slice(0, colonIdx);
  const tail = candidate.slice(colonIdx + 1);
  if (!head || !tail) return null;
  return { accountId: head, folder: null, uid: tail };
}

export function matchesMessageById(
  message: EmailMessage,
  candidateId: string | number,
): boolean {
  const candidate = String(candidateId);
  const msgKey = deriveConsolidatedKey(message);

  const parsed = parseCandidateKey(candidate);
  if (parsed) {
    if (!msgKey.accountId) return false;
    return consolidatedKeysMatch(msgKey, parsed);
  }

  if (msgKey.uid && msgKey.uid === candidate) {
    return true;
  }

  if (message.msg_no !== undefined && message.msg_no !== null) {
    if (String(message.msg_no) === candidate) return true;
  }

  if (message.id !== undefined && message.id !== null) {
    if (String(message.id) === candidate) return true;
  }

  return false;
}
