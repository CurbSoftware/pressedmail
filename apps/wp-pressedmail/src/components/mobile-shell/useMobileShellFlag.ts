"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "pm.mobile_shell_v2";

function readFlag(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/**
 * Reads the persisted mobile-shell rollout flag. Defaults to enabled. Backing
 * store is localStorage so support can flip the gate per-user without a
 * backend deploy. Phase D will promote this to user preferences when other
 * mobile-specific prefs join.
 */
export function useMobileShellFlag(): boolean {
  return useSyncExternalStore(subscribe, readFlag, () => true);
}
