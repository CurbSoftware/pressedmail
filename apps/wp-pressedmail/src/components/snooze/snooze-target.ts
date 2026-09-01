export interface SnoozeTarget {
  accountId: number;
  messageUid: string;
  folder: string;
  sourceUidValidity: string | number;
  sourceMessageId: string;
  subject?: string;
  from?: string;
  date?: string;
}

export interface SnoozeTargetCandidate {
  accountId?: unknown;
  messageUid?: unknown;
  folder?: unknown;
  sourceUidValidity?: unknown;
  sourceMessageId?: unknown;
  subject?: unknown;
  from?: unknown;
  date?: unknown;
}

export const INCOMPLETE_SNOOZE_IDENTITY_ERROR =
  "The message identity is incomplete. Reload it before snoozing.";

const CANONICAL_POSITIVE_INTEGER = /^[1-9][0-9]*$/;
const CANONICAL_MESSAGE_ID = /^<[^<>\s"\\]+@[^<>\s"\\]+>$/;

function canonicalPositiveInteger(value: unknown): string | number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string" || !CANONICAL_POSITIVE_INTEGER.test(value)) {
    return null;
  }
  const numberValue = Number(value);
  return Number.isSafeInteger(numberValue) && String(numberValue) === value
    ? value
    : null;
}

export function parseSnoozeTarget(
  candidate: SnoozeTargetCandidate,
): SnoozeTarget | null {
  const accountId = canonicalPositiveInteger(candidate.accountId);
  const messageUid = canonicalPositiveInteger(candidate.messageUid);
  const sourceUidValidity = canonicalPositiveInteger(
    candidate.sourceUidValidity,
  );
  const folder = candidate.folder;
  const sourceMessageId = candidate.sourceMessageId;

  if (
    typeof accountId !== "number" ||
    messageUid === null ||
    sourceUidValidity === null ||
    typeof folder !== "string" ||
    folder === "" ||
    folder.trim() !== folder ||
    folder.includes("\0") ||
    typeof sourceMessageId !== "string" ||
    (sourceMessageId !== "" && !CANONICAL_MESSAGE_ID.test(sourceMessageId))
  ) {
    return null;
  }

  return {
    accountId,
    messageUid: String(messageUid),
    folder,
    sourceUidValidity,
    sourceMessageId,
    ...(typeof candidate.subject === "string"
      ? { subject: candidate.subject }
      : {}),
    ...(typeof candidate.from === "string" ? { from: candidate.from } : {}),
    ...(typeof candidate.date === "string" ? { date: candidate.date } : {}),
  };
}

export function parseSnoozeTargets(
  candidates: readonly SnoozeTargetCandidate[],
): SnoozeTarget[] | null {
  if (candidates.length === 0) return null;

  const targets: SnoozeTarget[] = [];
  for (const candidate of candidates) {
    const target = parseSnoozeTarget(candidate);
    if (!target) return null;
    targets.push(target);
  }
  return targets;
}

export function getSnoozeTargetIdentityKey(target: SnoozeTarget): string {
  return JSON.stringify([
    target.accountId,
    target.messageUid,
    target.folder,
    String(target.sourceUidValidity),
    target.sourceMessageId,
  ]);
}
