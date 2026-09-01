import type { EmailMessage } from "@/types";

function arraysShallowEqual<T>(a?: T[], b?: T[]): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function tagsEqual(prev: EmailMessage["tags"], next: EmailMessage["tags"]) {
  if (prev === next) return true;
  if (!prev || !next) return prev === next;
  if (prev.length !== next.length) return false;

  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (
      a?.id !== b?.id ||
      a?.name !== b?.name ||
      a?.color !== b?.color ||
      a?.icon !== b?.icon
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Returns true when two EmailMessage references render identically as an
 * inbox-list row. Compared fields are the ones that drive row pixels: id/uid
 * (identity), read/starred/important (flag dots), subject/from/date (text),
 * sender email, preview/body text for details rows, and labels (chips).
 */
export function areMessageRowsEqual(
  prev: EmailMessage,
  next: EmailMessage,
): boolean {
  if (prev === next) return true;

  return (
    prev.id === next.id &&
    prev.uid === next.uid &&
    prev.read === next.read &&
    prev.starred === next.starred &&
    prev.important === next.important &&
    prev.subject === next.subject &&
    prev.from === next.from &&
    prev.email === next.email &&
    prev.date === next.date &&
    prev.receivedDate === next.receivedDate &&
    prev.preview === next.preview &&
    prev.snippet === next.snippet &&
    prev.text === next.text &&
    prev.textBody === next.textBody &&
    prev.plainBody === next.plainBody &&
    prev.body === next.body &&
    prev.htmlBody === next.htmlBody &&
    prev.hasAttachments === next.hasAttachments &&
    prev.accountId === next.accountId &&
    prev.accountEmail === next.accountEmail &&
    prev.accountProvider === next.accountProvider &&
    prev.accountLabel === next.accountLabel &&
    arraysShallowEqual(prev.labels, next.labels) &&
    tagsEqual(prev.tags, next.tags)
  );
}
