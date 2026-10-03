import type { EmailMessage } from "@/types";
import {
  getCacheService,
  getPrefetchService,
} from "@/services/implementations";

/**
 * The ensure-fetched gate for bulk AI operations (phishing, spam, auto-tag).
 *
 * Puts every target's body in the server mirror before the operation's
 * requests go out, so the analysis reads the database instead of opening a
 * live IMAP fetch per email. Bodies the mirror already holds are answered
 * from the database with no IMAP; whatever the gate cannot warm falls back to
 * the operation's own bounded fetch, exactly as before.
 *
 * Sequential per account and folder: the test sites run two PHP workers, so
 * bulk warming never goes parallel.
 */
export async function warmMessageBodies(
  messages: EmailMessage[],
  resolveAccount: (message: EmailMessage) => number | string | null | undefined,
  resolveFolder: (message: EmailMessage) => string,
  signal: AbortSignal,
): Promise<void> {
  const groups = new Map<
    string,
    { accountId: string; folder: string; messages: EmailMessage[] }
  >();
  for (const message of messages) {
    const accountId = resolveAccount(message);
    if (accountId === null || accountId === undefined) continue;
    const numeric = Number(accountId);
    if (!Number.isFinite(numeric) || numeric <= 0) continue;
    const folder = resolveFolder(message);
    const key = `${numeric} ${folder}`;
    const group =
      groups.get(key) ?? { accountId: String(numeric), folder, messages: [] };
    group.messages.push(message);
    groups.set(key, group);
  }

  const prefetch = getPrefetchService(getCacheService());
  for (const group of groups.values()) {
    if (signal.aborted) return;
    await prefetch.warmBulk(
      group.accountId,
      group.folder,
      group.messages,
      signal,
    );
  }
}
