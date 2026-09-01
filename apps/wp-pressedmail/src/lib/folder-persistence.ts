/**
 * Per-account folder persistence in localStorage.
 * Remembers which folder the user was viewing so it can be restored on page refresh.
 */

import { getUserPreferencesSnapshot } from "@/hooks/useUserPreferences";

const STORAGE_KEY = "pressedmail-selected-folder";

/** Save the selected folder for an account. */
export function saveSelectedFolder(accountEmail: string, folder: string): void {
  if (!getUserPreferencesSnapshot().email_list_remember_folder) {
    return;
  }
  try {
    const data = readAll();
    data[accountEmail] = folder;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be full or unavailable
  }
}

/** Forget the saved folder for an account (used when the account is removed). */
export function removeSelectedFolder(accountEmail: string): void {
  try {
    const data = readAll();
    if (accountEmail in data) {
      delete data[accountEmail];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // localStorage may be unavailable.
  }
}

/** Get the previously selected folder for an account. Returns null if none saved. */
export function getSelectedFolder(accountEmail: string): string | null {
  if (!getUserPreferencesSnapshot().email_list_remember_folder) {
    return null;
  }
  try {
    const data = readAll();
    return data[accountEmail] ?? null;
  } catch {
    return null;
  }
}

function readAll(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
