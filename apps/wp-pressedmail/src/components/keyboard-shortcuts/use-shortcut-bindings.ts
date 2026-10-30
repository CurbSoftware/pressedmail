import { useEffect, useSyncExternalStore } from "react";

import { apiFetch } from "@/lib/api-client";
import { getPluginRestBase } from "@/lib/runtime-config";

/** One row of GET /shortcuts: the person's key for an action. */
export interface ShortcutBinding {
  action: string;
  key: string;
  category: string;
  enabled: boolean;
  is_custom: boolean;
  default_key: string;
}

interface ShortcutBindingsState {
  bindings: ShortcutBinding[];
  /** The person's switch. On until the server says otherwise. */
  enabled: boolean;
  /** The preset last applied (Pro): default, gmail or outlook. */
  preset: string;
  loaded: boolean;
}

/**
 * One copy for the whole app: the listener and the settings page read the
 * same bindings, and a save on the settings page reaches the listener.
 */
const INITIAL_STATE: ShortcutBindingsState = {
  bindings: [],
  enabled: true,
  preset: "default",
  loaded: false,
};
let state = INITIAL_STATE;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Load the bindings and the switch again. A failed load keeps what was there:
 * shortcuts are a convenience, and the page works without them.
 *
 * Loads on mount share one request. After a save, pass `fresh`: a load that
 * started before the save could otherwise land last with the old keys.
 */
export function refreshShortcutBindings(fresh = false): Promise<void> {
  if (inFlight && !fresh) return inFlight;
  const next = (inFlight ?? Promise.resolve()).then(load);
  inFlight = next;
  void next.finally(() => {
    if (inFlight === next) inFlight = null;
  });
  return next;
}

async function load(): Promise<void> {
  try {
    const base = getPluginRestBase();
    const [list, settings] = await Promise.all([
      apiFetch(`${base}shortcuts`),
      apiFetch(`${base}shortcuts/settings`),
    ]);
    if (!list.ok || !settings.ok) return;
    const listData = (await list.json()) as { shortcuts?: unknown };
    const settingsData = (await settings.json()) as {
      shortcuts_enabled?: unknown;
      preset?: unknown;
    };
    state = {
      bindings: Array.isArray(listData.shortcuts)
        ? (listData.shortcuts as ShortcutBinding[])
        : [],
      enabled: settingsData.shortcuts_enabled !== false,
      preset:
        typeof settingsData.preset === "string"
          ? settingsData.preset
          : "default",
      loaded: true,
    };
    listeners.forEach((listener) => listener());
  } catch {
    // Keep the last good bindings.
  }
}

/** Save the person's switch, then reload so the listener follows it. */
export async function saveShortcutsEnabled(enabled: boolean): Promise<boolean> {
  try {
    const response = await apiFetch(`${getPluginRestBase()}shortcuts/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shortcuts_enabled: enabled }),
    });
    if (!response.ok) return false;
  } catch {
    return false;
  }
  await refreshShortcutBindings(true);
  return true;
}

export function useShortcutBindings(): ShortcutBindingsState {
  useEffect(() => {
    if (!state.loaded) void refreshShortcutBindings();
  }, []);
  return useSyncExternalStore(subscribe, () => state);
}

/** For tests: forget everything loaded. */
export function resetShortcutBindingsForTests(): void {
  state = INITIAL_STATE;
  inFlight = null;
}
