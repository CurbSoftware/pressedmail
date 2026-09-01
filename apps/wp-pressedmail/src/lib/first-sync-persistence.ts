/**
 * Per-account/scope "first-ever sync completed" persistence in localStorage.
 *
 * Drives the one-time full-screen "Syncing…" gate: the very first time an
 * account (or a consolidated scope) is opened, the inbox waits for the initial
 * message load; on every later visit the cached inbox shows immediately while
 * the background poller keeps it in sync. The key is the same persistenceKey
 * used by folder-persistence (account email, or the consolidated scope key).
 */

const STORAGE_KEY = "pressedmail-first-sync-done";

/** Record that an account/scope has completed its first-ever sync. */
export function markFirstSyncComplete(key: string): void {
  if (!key) {
    return;
  }
  try {
    const data = readAll();
    data[key] = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be full or unavailable.
  }
}

/** Forget an account/scope's first-sync flag (used when the account is removed). */
export function removeFirstSync(key: string): void {
  if (!key) {
    return;
  }
  try {
    const data = readAll();
    if (key in data) {
      delete data[key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // localStorage may be unavailable.
  }
}

/** Whether an account/scope has completed its first-ever sync. */
export function hasCompletedFirstSync(key: string): boolean {
  if (!key) {
    return false;
  }
  try {
    return readAll()[key] === true;
  } catch {
    return false;
  }
}

function readAll(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}
