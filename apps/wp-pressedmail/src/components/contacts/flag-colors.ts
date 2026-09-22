/**
 * Flag colors
 *
 * Contact "flags" are plain strings stored on `contact.tags`. Their display
 * color is a per-user preference (`contact_flag_colors`) keyed by the
 * normalized flag name. When a user has not chosen a color we fall back to a
 * stable hash-derived color from {@link TAG_COLORS} so every flag still reads
 * as colored.
 *
 * @since 1.4.0
 */
import { useCallback } from "react";

import { useUserPreferences } from "@/hooks/useUserPreferences";
import { isHexColor } from "@/lib/hex-color";
import { TAG_COLORS } from "@/types/tags";
import { normalizeKeyword } from "./keyword-utils";

export type FlagColorMap = Record<string, string>;

const FALLBACK_COLOR = "var(--muted-foreground)";

function stableIndex(name: string): number {
  return name
    .split("")
    .reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
}

/** Stable hash-derived color used when the user has not chosen one. */
export function fallbackFlagColor(name: string): string {
  const normalized = normalizeKeyword(name);
  if (!normalized) {
    return TAG_COLORS[0] ?? FALLBACK_COLOR;
  }
  return (
    TAG_COLORS[stableIndex(normalized) % TAG_COLORS.length] ??
    TAG_COLORS[0] ??
    FALLBACK_COLOR
  );
}

/** Resolve a flag's display color: user choice first, else stable fallback. */
export function resolveFlagColor(
  name: string,
  colors?: FlagColorMap | null,
): string {
  const normalized = normalizeKeyword(name);
  const explicit = colors?.[normalized]?.trim();
  if (explicit && isHexColor(explicit)) {
    return explicit;
  }
  return fallbackFlagColor(name);
}

/** Translate a hex color into an `rgba()` string for soft chip tints. */
export function withAlpha(hex: string, alpha: number): string {
  if (typeof hex !== "string" || !hex.startsWith("#")) {
    return hex;
  }
  const cleaned = hex.replace("#", "");
  const expanded =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  if (expanded.length < 6) {
    return hex;
  }
  const r = parseInt(expanded.substring(0, 2), 16);
  const g = parseInt(expanded.substring(2, 4), 16);
  const b = parseInt(expanded.substring(4, 6), 16);
  if ([r, g, b].some((c) => Number.isNaN(c))) {
    return hex;
  }
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Coerce a raw preference value into a clean flag-color map. The REST backend
 * returns `[]` for an empty map, and may echo unexpected shapes, so callers
 * normalize before use.
 */
export function normalizeFlagColorMap(value: unknown): FlagColorMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const out: FlagColorMap = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const name = normalizeKeyword(key);
    if (!name || typeof raw !== "string") {
      continue;
    }
    const hex = raw.trim().toLowerCase();
    if (isHexColor(hex)) {
      out[name] = hex;
    }
  }
  return out;
}

/**
 * Hook exposing the per-user flag color map plus helpers that keep it in sync
 * when flags are created, recolored, renamed, or deleted.
 */
export function useFlagColors() {
  const { preferences, updatePreference } = useUserPreferences();
  const colors = normalizeFlagColorMap(
    preferences.contact_flag_colors as unknown,
  );

  const setFlagColor = useCallback(
    (name: string, hex: string) => {
      const normalized = normalizeKeyword(name);
      const value = hex.trim().toLowerCase();
      if (!normalized || !isHexColor(value)) {
        return Promise.resolve(false);
      }
      return updatePreference("contact_flag_colors", {
        ...colors,
        [normalized]: value,
      });
    },
    [colors, updatePreference],
  );

  const removeFlagColor = useCallback(
    (name: string) => {
      const normalized = normalizeKeyword(name);
      if (!normalized || !(normalized in colors)) {
        return Promise.resolve(true);
      }
      const next = { ...colors };
      delete next[normalized];
      return updatePreference("contact_flag_colors", next);
    },
    [colors, updatePreference],
  );

  const renameFlagColor = useCallback(
    (oldName: string, newName: string) => {
      const from = normalizeKeyword(oldName);
      const to = normalizeKeyword(newName);
      if (!from || !to || from === to || !(from in colors)) {
        return Promise.resolve(true);
      }
      const next = { ...colors };
      const color = next[from];
      delete next[from];
      if (color) {
        next[to] = color;
      }
      return updatePreference("contact_flag_colors", next);
    },
    [colors, updatePreference],
  );

  const resolveColor = useCallback(
    (name: string) => resolveFlagColor(name, colors),
    [colors],
  );

  return {
    colors,
    setFlagColor,
    removeFlagColor,
    renameFlagColor,
    resolveColor,
  };
}
