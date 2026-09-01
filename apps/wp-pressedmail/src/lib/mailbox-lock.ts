/**
 * PressedMail Lock boot-status reader + tiny client store.
 *
 * The optional lock passphrase gates interactive mailbox access per browser
 * session. PHP injects the current session's lock state synchronously into
 * `window.pressedmailPlugin.lock`, so a locked session renders the LockGate on
 * first paint with zero extra round-trips. Mid-session, the API client
 * dispatches MAILBOX_LOCKED_EVENT when any request answers 423 (inactivity
 * expiry, "lock all sessions" from another browser), flipping the store,
 * and therefore the gate, without a reload.
 *
 * Fail OPEN on missing data: only an explicit `enabled && locked` boot state
 * locks. The server-side locks (credential guard, mirror reads, REST 423)
 * stay authoritative if this UI is ever bypassed.
 */

import { MAILBOX_LOCKED_EVENT } from "@/lib/api-client";

export interface MailboxLockRuntimeStatus {
  enabled?: boolean;
  locked?: boolean;
  timeout_seconds?: number;
  migration_prompt?: boolean;
}

export interface MailboxLockState {
  enabled: boolean;
  locked: boolean;
  timeoutSeconds: number;
  migrationPrompt: boolean;
}

type Listener = (state: MailboxLockState) => void;

function normalize(
  status: MailboxLockRuntimeStatus | undefined,
): MailboxLockState {
  const enabled = status?.enabled === true;

  return {
    enabled,
    locked: enabled && status?.locked === true,
    timeoutSeconds:
      typeof status?.timeout_seconds === "number" ? status.timeout_seconds : 0,
    migrationPrompt: status?.migration_prompt === true,
  };
}

/** Read the raw injected boot status, if any. */
export function readMailboxLockStatus(): MailboxLockRuntimeStatus | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.pressedmailPlugin?.lock;
}

let state: MailboxLockState = normalize(readMailboxLockStatus());
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) {
    listener(state);
  }
}

/** Current lock state (boot payload until a server response updates it). */
export function getMailboxLockState(): MailboxLockState {
  return state;
}

/** Replace the store from a server `lock` payload (unlock/lock responses). */
export function setMailboxLockStatus(
  status: MailboxLockRuntimeStatus | undefined,
): void {
  if (!status) {
    return;
  }
  state = normalize(status);
  emit();
}

/** Flip to locked: called when any plugin request answers 423. */
export function markMailboxLocked(): void {
  if (state.enabled && state.locked) {
    return;
  }
  // A 423 is proof the lock is enabled server-side, whatever boot said.
  state = { ...state, enabled: true, locked: true };
  emit();
}

/** Subscribe to state changes; returns the unsubscribe function. */
export function subscribeMailboxLock(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test hook: re-read the boot payload and drop all listeners. */
export function resetMailboxLockStateForTests(): void {
  listeners.clear();
  state = normalize(readMailboxLockStatus());
}

if (typeof window !== "undefined") {
  window.addEventListener(MAILBOX_LOCKED_EVENT, markMailboxLocked);
}
