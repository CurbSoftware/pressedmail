/**
 * The shape of the browser storage key a look-and-feel preference lives under:
 * the prefix, then the site, the user and the preference's own name.
 *
 * No imports, on purpose. The E2E and capture tooling loads this file from
 * outside the app to find or clear scoped keys, so the format is written once.
 */
export const PREFERENCE_PREFIX = "pressedmail:preference:v1:";

export function scopedPreferenceKey(
  site: string,
  userId: number,
  name: string,
): string {
  return PREFERENCE_PREFIX + JSON.stringify([site, userId, name]);
}

/** The preference a scoped key holds, or null for any other key. */
export function preferenceNameOf(storageKey: string): string | null {
  if (!storageKey.startsWith(PREFERENCE_PREFIX)) return null;
  try {
    const parts: unknown = JSON.parse(
      storageKey.slice(PREFERENCE_PREFIX.length),
    );
    return Array.isArray(parts) && typeof parts[2] === "string"
      ? parts[2]
      : null;
  } catch {
    return null;
  }
}
