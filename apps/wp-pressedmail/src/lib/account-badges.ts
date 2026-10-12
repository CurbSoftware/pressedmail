/**
 * Account badges
 *
 * Two accounts can derive the same inbox badge (both "alex@..." read
 * "Alex"). The per-viewer `account_badges` preference lets a person give
 * each account an alias and a color, keyed by account id. It is per viewer.
 * Only the mailboxes the combined inbox lists carry a badge, and a shared
 * mailbox is never one of them (getAvailableAccountIds). With nothing set, the
 * badge is exactly what it was.
 */
import { useCallback, useMemo, type CSSProperties } from "react";

import { getEmailTagBadgeStyle } from "@/components/tags/tag-visuals";
import {
  getUserPreferencesSnapshot,
  useUserPreferences,
  type UserPreferences,
} from "@/hooks/useUserPreferences";
import { isHexColor } from "@/lib/hex-color";

/** Mirrors UserPreferences::ACCOUNT_BADGE_ALIAS_MAX_LENGTH. */
export const ACCOUNT_BADGE_ALIAS_MAX_LENGTH = 24;

export type AccountBadgeMap = UserPreferences["account_badges"];

/**
 * Coerce a raw preference value into a clean badge map. The REST backend
 * returns `[]` for an empty map, so callers normalize before use.
 */
export function normalizeAccountBadgeMap(value: unknown): AccountBadgeMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const out: AccountBadgeMap = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const { alias, color } = raw as { alias?: unknown; color?: unknown };
    const entry: AccountBadgeMap[string] = {};
    const trimmedAlias = typeof alias === "string" ? alias.trim() : "";
    if (trimmedAlias) {
      entry.alias = trimmedAlias;
    }
    if (typeof color === "string" && isHexColor(color.trim())) {
      entry.color = color.trim().toLowerCase();
    }
    if (entry.alias || entry.color) {
      out[id] = entry;
    }
  }
  return out;
}

/**
 * The badge a row shows for an account: the viewer's alias or else the label
 * the row already had, plus the viewer's color when they chose one.
 */
export function resolveAccountBadge(
  badges: AccountBadgeMap | undefined,
  accountId: number | string | null | undefined,
  fallbackLabel: string,
): { label: string; color?: string } {
  const entry =
    accountId == null || !badges ? undefined : badges[String(accountId)];
  const label = entry?.alias || fallbackLabel;
  return entry?.color ? { label, color: entry.color } : { label };
}

/**
 * Inline style for a badge the viewer colored: the tag chip's tint, so light
 * and dark modes and contrast come from the same code. None without a color.
 */
export function accountBadgeStyle(badge: {
  label: string;
  color?: string;
}): CSSProperties | undefined {
  return badge.color
    ? getEmailTagBadgeStyle({ id: 0, name: badge.label, color: badge.color })
    : undefined;
}

/** The viewer's badge map, plus a setter that writes one account's entry. */
export function useAccountBadges() {
  const { preferences, updatePreference } = useUserPreferences();
  const badges = useMemo(
    () => normalizeAccountBadgeMap(preferences.account_badges as unknown),
    [preferences.account_badges],
  );

  /** Save one account's alias and color; an empty badge removes the entry. */
  const setAccountBadge = useCallback(
    (accountId: number | string, badge: { alias?: string; color?: string }) => {
      // Read the live map, not the render's, so two quick saves cannot undo each other.
      const next = normalizeAccountBadgeMap(
        getUserPreferencesSnapshot().account_badges as unknown,
      );
      const key = String(accountId);
      const merged = normalizeAccountBadgeMap({ [key]: badge })[key];
      if (merged) {
        next[key] = merged;
      } else {
        delete next[key];
      }
      return updatePreference("account_badges", next);
    },
    [updatePreference],
  );

  return { badges, setAccountBadge };
}
