import { publishTabMessage } from "@/lib/tab-channel";

/**
 * The mailbox mirror's stamp as the sync endpoints last reported it.
 *
 * The server hashes what a reader can see of each folder (counts, the newest message, the sync
 * phase, local edits), so a new stamp means the open list or the folder counts may have moved.
 * Backfill of older mail leaves it alone. Only the tab that drives sync sees most stamps, so a
 * change is told to this tab's views and to the other tabs. The first stamp counts as a change
 * too: the server computes it after the work it just did, which a view loaded a moment earlier
 * has not seen. That costs one database refresh when the app opens.
 */
let last = "";
const listeners = new Set<() => void>();

/** Record a stamp from a sync answer. Anything but a non-empty string is ignored. */
export function noteMirrorStamp(stamp: unknown): void {
  if (typeof stamp !== "string" || stamp === "") return;
  if (stamp === last) return;
  last = stamp;
  publishTabMessage({ type: "mail-changed", accounts: "all" });
  listeners.forEach((listener) => listener());
}

/** Run `listener` whenever the mirror changes. Returns the unsubscribe. */
export function subscribeMirrorChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
