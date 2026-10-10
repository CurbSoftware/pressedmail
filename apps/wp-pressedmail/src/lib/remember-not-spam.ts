import { chunkByAccount } from "@/lib/account-chunks";
import { getMessageIdentityKey } from "@/lib/message-identity";
import type { EmailMessage } from "@/types";

/** Most rows one Not spam press tells the site about. The move covers every selected row; the rest are simply not remembered. */
export const REMEMBER_NOT_SPAM_MAX = 50;

/** Longest a Not spam press waits for the site to remember the senders before it moves the mail anyway. */
export const REMEMBER_NOT_SPAM_BUDGET_MS = 3000;

/**
 * Moving mail out of Junk is also the user saying these senders are fine, so the site is told first. It is a favour to the
 * next message from them, never a condition of this move: it covers the first rows only, stops waiting after a few
 * seconds, and swallows every failure. Resolves when it has finished or run out of time, whichever comes first.
 */
export async function rememberNotSpamBounded(
  messages: readonly EmailMessage[],
  accountOf: (message: EmailMessage) => number | null | undefined,
  remember: (accountId: number, messageIds: string[]) => Promise<void>,
): Promise<void> {
  const work = (async () => {
    try {
      for (const group of chunkByAccount(
        messages.slice(0, REMEMBER_NOT_SPAM_MAX),
        accountOf,
        REMEMBER_NOT_SPAM_MAX,
      )) {
        await remember(group.accountId, group.items.map(getMessageIdentityKey));
      }
    } catch {
      // Not saving what the sender is must never stop the mail leaving Junk.
    }
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, REMEMBER_NOT_SPAM_BUDGET_MS);
  });
  try {
    await Promise.race([work, budget]);
  } finally {
    clearTimeout(timer);
  }
}
