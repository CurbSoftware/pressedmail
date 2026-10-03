import { useSyncExternalStore } from "react";

/**
 * Open state of the phone's notifications sheet.
 *
 * A module-level store, for the same reason the activity panel has one: the
 * Inbox header's bell and the More screen's row both open the one sheet the
 * application layout mounts, and neither owns it.
 */
let openState = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function setNotificationsSheetOpen(next: boolean): void {
  if (openState !== next) {
    openState = next;
    emit();
  }
}

export function openNotificationsSheet(): void {
  setNotificationsSheetOpen(true);
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): boolean {
  return openState;
}

export function useNotificationsSheetOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
