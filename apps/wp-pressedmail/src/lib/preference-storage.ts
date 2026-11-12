import { scopedPreferenceKey } from "@/lib/preference-key";
import {
  captureRequestPrincipal,
  type StoragePrincipal,
} from "@/lib/principal-storage";

/**
 * Look-and-feel preferences (theme, layout, typography, light or dark, the
 * white-label default markers) are kept per site and per WordPress user.
 *
 * One origin can serve several sites (a subdirectory multisite, /blog and
 * /shop installs) and one browser profile several users. A bare key made one
 * site's choice the next site's, where it also read as the user's own pick and
 * overrode that site's white-label default.
 *
 * These keys do not use the mail prefix in principal-storage.ts on purpose:
 * everything under that prefix is deleted at sign-out, and a theme must
 * survive signing out and back in.
 */
/** Holds the keys already carried over from the bare keys 1.8.11 wrote. */
const CARRIED_KEY = "pressedmail-preferences-carried";

let carriedFor: StoragePrincipal | null = null;
let carried = new Set<string>();

function physicalKey(principal: StoragePrincipal, key: string): string {
  return scopedPreferenceKey(principal.site, principal.userId, key);
}

/**
 * The localStorage key a preference lives under for this site and this user.
 *
 * The first time a key is asked for, the value 1.8.11 stored under the bare
 * key is copied in, so an update keeps everyone's look. The bare key is left
 * alone: another site on this origin may not have read it yet. The copy
 * happens once per key, so removing a preference later stays removed.
 *
 * With no site or user to scope by (no boot payload), this is the bare key.
 */
export function preferenceStorageKey(key: string): string {
  // A page whose session was taken over keeps the scope it started with
  // until it reloads, so a late write never lands on the bare key.
  const principal = captureRequestPrincipal() ?? carriedFor;
  if (!principal) return key;
  const scoped = physicalKey(principal, key);
  try {
    const carriedKey = physicalKey(principal, CARRIED_KEY);
    if (carriedFor !== principal) {
      carriedFor = principal;
      carried = new Set();
      const stored: unknown = JSON.parse(
        localStorage.getItem(carriedKey) ?? "[]",
      );
      if (Array.isArray(stored)) carried = new Set(stored as string[]);
    }
    if (!carried.has(key)) {
      carried.add(key);
      const legacy = localStorage.getItem(key);
      if (legacy !== null && localStorage.getItem(scoped) === null) {
        localStorage.setItem(scoped, legacy);
      }
      localStorage.setItem(carriedKey, JSON.stringify([...carried]));
    }
  } catch {
    /* Storage can be disabled or full. The preference then lasts for the page. */
  }
  return scoped;
}

/** localStorage for preferences: scoped per site and user, and never throws. */
export function safeLocalStorage() {
  return {
    getItem: (key: string): string | null => {
      try {
        return localStorage.getItem(preferenceStorageKey(key));
      } catch {
        return null;
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        localStorage.setItem(preferenceStorageKey(key), value);
      } catch (error) {
        console.warn("Failed to save to localStorage:", error);
      }
    },
    removeItem: (key: string): void => {
      try {
        localStorage.removeItem(preferenceStorageKey(key));
      } catch (error) {
        console.warn("Failed to remove from localStorage:", error);
      }
    },
  };
}
