import { useSyncExternalStore } from "react";

/**
 * Shared open-state for the unified Activity panel (the process/activity sheet).
 *
 * A module-level store (not component state) so MULTIPLE triggers can drive the
 * single mounted {@link ActivitySheet}: the header Activity button and the footer
 * status-bar toggle both open/close the same sheet. Mirrors the lightweight store
 * style of `useProcessQueue`.
 */
let openState = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Open the activity panel. */
export function openActivityPanel(): void {
  if (!openState) {
    openState = true;
    emit();
  }
}

/** Close the activity panel. */
export function closeActivityPanel(): void {
  if (openState) {
    openState = false;
    emit();
  }
}

/** Toggle the activity panel open/closed. */
export function toggleActivityPanel(): void {
  openState = !openState;
  emit();
}

/** Set the activity panel open state explicitly (e.g. the sheet's onOpenChange). */
export function setActivityPanelOpen(next: boolean): void {
  if (openState !== next) {
    openState = next;
    emit();
  }
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

/** Subscribe a component to the activity panel open state. */
export function useActivityPanelOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
