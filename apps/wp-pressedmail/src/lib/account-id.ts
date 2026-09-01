/**
 * Resolve a usable account id from a server add-account response.
 *
 * The server returns the real database id on success. A clock-based fallback
 * (e.g. `Date.now()`) must NEVER be substituted: a millisecond-epoch value is
 * not a real account row, so every subsequent `messages/get/{id}` request 404s
 * (this is exactly the 1780813317638-style id seen in the console). When the
 * server did not return a valid id, return null so callers fail loudly instead
 * of seeding a broken account into the list.
 *
 * @param value Candidate id from the server payload.
 * @returns The id (number or numeric string) when valid, otherwise null.
 */
export function resolveServerAccountId(value: unknown): number | string | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return /^\d+$/.test(trimmed) && Number(trimmed) > 0 ? trimmed : null;
  }

  return null;
}
