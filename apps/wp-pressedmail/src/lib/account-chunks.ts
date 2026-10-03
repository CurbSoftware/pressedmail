import { _n, sprintf } from "@wordpress/i18n";

/**
 * Group items by account, keeping selection order, and cut each group into
 * chunks of at most `size`. Items without an account are skipped.
 */
export function chunkByAccount<T>(
  items: readonly T[],
  accountOf: (item: T) => number | null | undefined,
  size: number,
): Array<{ accountId: number; items: T[] }> {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const accountId = accountOf(item);
    if (!accountId) continue;
    const group = groups.get(accountId) ?? [];
    group.push(item);
    groups.set(accountId, group);
  }

  const chunks: Array<{ accountId: number; items: T[] }> = [];
  for (const [accountId, group] of groups) {
    for (let start = 0; start < group.length; start += Math.max(1, size)) {
      chunks.push({ accountId, items: group.slice(start, start + Math.max(1, size)) });
    }
  }
  return chunks;
}

/** The end-of-run note for a bulk AI run where some emails failed. */
export function bulkAiFailureMessage(failed: number, firstError: string): string {
  const count = sprintf(
    /* translators: %d: number of emails that could not be checked. */
    _n(
      "%d email couldn't be checked.",
      "%d emails couldn't be checked.",
      failed,
      "pressedmail",
    ),
    failed,
  );
  return firstError ? `${count} ${firstError}` : count;
}
