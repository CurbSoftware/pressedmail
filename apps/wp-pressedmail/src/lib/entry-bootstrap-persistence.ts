import {
  getPrincipalStorageItem,
  removePrincipalStorageItem,
  setPrincipalStorageItem,
} from "@/lib/principal-storage";
/**
 * Per-session "entry bootstrap completed" persistence in sessionStorage.
 *
 * The entry bootstrap warms every account's mailbox mirror once when the inbox
 * surface is first opened in a browser session. The Inbox is a static,
 * remounting route element, so without a persisted watermark the gate's
 * "already bootstrapped?" guard (a per-mount ref) resets on every navigation and
 * the full-screen "Syncing…" gate re-fires. sessionStorage scopes completion to
 * the tab session: SPA remounts and in-tab reloads skip the re-warm (the cron
 * sweep + visibility-gated poller keep the mirror fresh), while a new tab/session
 * warms again. The key is the sorted account-id list (entryBootstrapKey).
 */

const STORAGE_KEY = "pressedmail-entry-bootstrap-done";

/** Record that the given account-set has completed its entry bootstrap. */
export function markEntryBootstrapComplete(key: string): void {
  if (!key) {
    return;
  }
  try {
    const data = readAll();
    data[key] = true;
    setPrincipalStorageItem("session", STORAGE_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage may be full or unavailable.
  }
}

/**
 * Forget all entry-bootstrap watermarks. The key is the sorted account-id SET,
 * so removing any one account invalidates every combined key, clearing the
 * whole map lets the surviving set re-warm cleanly.
 */
export function clearAllEntryBootstrap(): void {
  try {
    removePrincipalStorageItem("session", STORAGE_KEY);
  } catch {
    // sessionStorage may be unavailable.
  }
}

/** Whether the given account-set has completed its entry bootstrap this session. */
export function hasCompletedEntryBootstrap(key: string): boolean {
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
    const raw = getPrincipalStorageItem("session", STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}
