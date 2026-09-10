import {
  getPrincipalStorageItem,
  setPrincipalStorageItem,
} from "@/lib/principal-storage";
import type { EmailMessage } from "@/types";
import type { ComposeMode } from "@/components/inbox/compose/compose-utils";

const STORAGE_KEY = "pressedmail-open-pane";
const STATE_TTL_MS = 12 * 60 * 60 * 1000;

export type PersistedPaneMode = "reading" | "compose";

export interface PersistedPaneState {
  mode?: PersistedPaneMode;
  composeMode?: ComposeMode;
  selectedMessage?: EmailMessage | null;
  savedAt: string;
}

type PersistedPaneMap = Record<string, PersistedPaneState>;

function getScopeKey(accountKey: string, folder: string): string {
  return `${accountKey}::${folder || "INBOX"}`;
}

function readAllStates(): PersistedPaneMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = getPrincipalStorageItem("session", STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedPaneMap) : {};
  } catch {
    return {};
  }
}

function writeAllStates(states: PersistedPaneMap): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    setPrincipalStorageItem("session", STORAGE_KEY, JSON.stringify(states));
  } catch {
    // Ignore sessionStorage quota/unavailability failures.
  }
}

function cloneMessageForStorage(
  message: EmailMessage | null,
): EmailMessage | null {
  if (!message) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(message)) as EmailMessage;
  } catch {
    return { ...message };
  }
}

function updatePaneState(
  accountKey: string,
  folder: string,
  updater: (current: PersistedPaneState | null) => PersistedPaneState | null,
): void {
  if (!accountKey) {
    return;
  }

  const states = readAllStates();
  const scopeKey = getScopeKey(accountKey, folder);
  const current = states[scopeKey] ?? null;
  const next = updater(current);

  if (next === null) {
    delete states[scopeKey];
  } else {
    states[scopeKey] = {
      ...next,
      savedAt: new Date().toISOString(),
    };
  }

  writeAllStates(states);
}

export function getPersistedPaneState(
  accountKey: string,
  folder: string,
): PersistedPaneState | null {
  if (!accountKey) {
    return null;
  }

  const states = readAllStates();
  const state = states[getScopeKey(accountKey, folder)] ?? null;

  if (!state) {
    return null;
  }

  const savedAt = Date.parse(state.savedAt);
  if (Number.isNaN(savedAt) || Date.now() - savedAt > STATE_TTL_MS) {
    clearPersistedPaneState(accountKey, folder);
    return null;
  }

  return state;
}

export function savePaneMode(
  accountKey: string,
  folder: string,
  mode: PersistedPaneMode,
  composeMode?: ComposeMode,
): void {
  updatePaneState(accountKey, folder, (current) => ({
    ...(current ?? { savedAt: new Date().toISOString() }),
    mode,
    composeMode: mode === "compose" ? (composeMode ?? "new") : undefined,
  }));
}

export function savePaneSelection(
  accountKey: string,
  folder: string,
  selectedMessage: EmailMessage,
): void {
  updatePaneState(accountKey, folder, (current) => ({
    ...(current ?? { savedAt: new Date().toISOString() }),
    selectedMessage: cloneMessageForStorage(selectedMessage),
  }));
}

export function clearPaneSelection(accountKey: string, folder: string): void {
  updatePaneState(accountKey, folder, (current) => ({
    ...(current ?? { savedAt: new Date().toISOString() }),
    selectedMessage: null,
  }));
}

export function clearPersistedPaneState(
  accountKey: string,
  folder: string,
): void {
  updatePaneState(accountKey, folder, () => null);
}
