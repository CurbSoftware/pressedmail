/**
 * Per-account client-state reconciliation + cleanup.
 *
 * When an account is removed (or removed and re-added on a new plugin version,
 * which gives it a NEW auto-increment database id), the client must not keep
 * stale per-account state around. Otherwise sync tokens, caches, folder
 * selection and the first-sync gate, keyed by the OLD id/email, linger and
 * confuse the mailbox (the user's "clearing localStorage fixes it" symptom).
 *
 * This module finds which persisted account identities no longer exist on the
 * server and purges their client state from localStorage + sessionStorage.
 */

import { removeSelectedFolder } from "./folder-persistence";
import { removeFirstSync } from "./first-sync-persistence";
import { clearAllEntryBootstrap } from "./entry-bootstrap-persistence";

export interface AccountIdentity {
  email?: string | null;
  id?: string | number | null;
}

/**
 * sessionStorage stores whose keys are prefixed with `${accountId}:`.
 * (sync tokens + folder sync state; message/detail/folder caches.)
 */
const ID_KEYED_SESSION_STORES = [
  "pressedmail-sync-tokens",
  "pressedmail-sync-state",
  "pressedmail-message-cache",
  "pressedmail-detail-cache",
  "pressedmail-folder-cache",
] as const;

/**
 * Identities present in `prev` whose exact (email, id) PAIR is absent from
 * `server`. This catches both a fully-removed account AND a same-email-new-id
 * re-add (the old id's state is stale and must be purged).
 */
export function findRemovedAccountIdentities<T extends AccountIdentity>(
  prev: readonly T[],
  server: readonly T[],
): T[] {
  return prev.filter(
    (p) =>
      !server.some(
        (s) =>
          String(s.id ?? "") === String(p.id ?? "") &&
          (s.email ?? "") === (p.email ?? ""),
      ),
  );
}

/**
 * Purge every trace of one account identity from client storage.
 */
export function clearAccountClientState(identity: AccountIdentity): void {
  const email =
    identity.email != null && identity.email !== "" ? identity.email : undefined;
  const id = identity.id != null ? String(identity.id) : undefined;

  if (email) {
    removeSelectedFolder(email);
    removeFirstSync(email);
  }

  if (id) {
    for (const storageKey of ID_KEYED_SESSION_STORES) {
      pruneSessionMapByIdPrefix(storageKey, id);
    }
  }

  // Entry-bootstrap watermarks are keyed by the sorted account-id SET, so any
  // membership change invalidates them. Clear wholesale.
  clearAllEntryBootstrap();
}

/**
 * Reconcile persisted accounts against the freshly-loaded server list: purge
 * client state for every identity that is gone, and return the removed ids so
 * callers can also prune id-based selection state.
 */
export function reconcileRemovedAccounts<T extends AccountIdentity>(
  prev: readonly T[],
  server: readonly T[],
): T[] {
  const removed = findRemovedAccountIdentities(prev, server);
  for (const identity of removed) {
    clearAccountClientState(identity);
  }
  return removed;
}

function pruneSessionMapByIdPrefix(storageKey: string, id: string): void {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) {
      return;
    }
    const data = JSON.parse(raw) as Record<string, unknown>;
    const prefix = `${id}:`;
    let changed = false;
    for (const key of Object.keys(data)) {
      if (key.startsWith(prefix)) {
        delete data[key];
        changed = true;
      }
    }
    if (changed) {
      sessionStorage.setItem(storageKey, JSON.stringify(data));
    }
  } catch {
    // sessionStorage may be unavailable / malformed, best effort.
  }
}
