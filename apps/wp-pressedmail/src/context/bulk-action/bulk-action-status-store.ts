import { useSyncExternalStore } from "react";

import { getMessageIdentityKey } from "@/lib/message-identity";
import { getInboxService } from "@/services/implementations";

/**
 * Per-row status for bulk list mutations (spam, delete, not spam, restore).
 *
 * Same shape as the phishing analysis cache: a Map keyed by
 * `getMessageIdentityKey(message)`, written as each chunk of the bulk
 * operation responds, read by the row indicator in the right rail. A
 * module-level store (the `use-activity-panel.ts` pattern) rather than a
 * context provider: the data is transient and every writer and reader can
 * import the store directly.
 */
export type BulkActionKind = "mark-spam" | "delete" | "not-spam" | "restore";

export type BulkActionPhase = "running" | "done" | "failed";

export interface BulkActionStatus {
  action: BulkActionKind;
  phase: BulkActionPhase;
}

const statuses = new Map<string, BulkActionStatus>();
const listeners = new Set<() => void>();

// useSyncExternalStore needs a stable snapshot object per state change, so
// rows cache what they read and bail out of re-renders on unrelated writes.
let statusSnapshot: ReadonlyMap<string, BulkActionStatus> = statuses;

function emit(): void {
  statusSnapshot = new Map(statuses);
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): ReadonlyMap<string, BulkActionStatus> {
  return statusSnapshot;
}

/** Mark a batch of identity keys with the same status. */
export function markBulkActionStatuses(
  keys: string[],
  status: BulkActionStatus,
): void {
  let changed = false;
  for (const key of keys) {
    if (key === "") continue;
    const current = statuses.get(key);
    if (
      !current ||
      current.action !== status.action ||
      current.phase !== status.phase
    ) {
      statuses.set(key, status);
      changed = true;
    }
  }
  if (changed) emit();
}

/** Clear the status for a batch of identity keys. */
export function clearBulkActionStatuses(keys: string[]): void {
  let changed = false;
  for (const key of keys) {
    if (key !== "" && statuses.delete(key)) changed = true;
  }
  if (changed) emit();
}

/** Subscribe a row to its bulk action status, if any. */
export function useBulkActionStatus(
  key: string,
): BulkActionStatus | undefined {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return snapshot.get(key);
}

/**
 * Remove messages whose server-side mutation finished, after a
 * `deferRemoval` batch operation completes. Also clears the reading-pane
 * selection when the open message is among them, matching what inline
 * removal does for single-shot batches.
 *
 * Every removal is also recorded, so a failure handler that marks the whole
 * selection failed can skip rows that already left the list: re-marking a
 * removed row would leave a stale icon behind if the message is ever listed
 * again.
 */
const removalLog: string[] = [];

export function applyDeferredRemoval(localIds: string[]): void {
  if (localIds.length === 0) return;
  const inboxService = getInboxService();
  const removedKeys = new Set(localIds);
  for (const localId of localIds) {
    inboxService.removeMessage(localId);
  }
  removalLog.push(...localIds);
  const selectedMessage = inboxService.selectedMessage;
  if (
    selectedMessage &&
    removedKeys.has(getMessageIdentityKey(selectedMessage))
  ) {
    inboxService.clearSelection();
  }
  // The rows are gone; their status entries go with them so the store stays
  // bounded. Failed rows keep theirs, and their rows are still listed.
  clearBulkActionStatuses(localIds);
}

/**
 * Take and clear the keys removed since the last drain. A bulk runner reads
 * this in its failure paths to avoid marking rows failed that already left
 * the list through a deferred removal.
 */
export function drainBulkActionRemovals(): string[] {
  if (removalLog.length === 0) return [];
  const drained = removalLog.splice(0, removalLog.length);
  return drained;
}
