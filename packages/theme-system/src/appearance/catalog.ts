import type {
  AppearanceCatalog,
  AppearanceMode,
  AppearancePreferenceInput,
  AppearancePreferences,
} from '../types/preferences';

/** Normalize stored tokens without imposing product-specific aliases. */
export function normalizeAppearanceToken(value: string): string {
  return value.trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
}

function aliasTarget(
  value: string | undefined,
  aliases: Readonly<Record<string, string>> | undefined,
): string | undefined {
  if (!value) return undefined;
  const normalized = normalizeAppearanceToken(value);
  const normalizedAliases = new Map(
    Object.entries(aliases ?? {}).map(([alias, target]) => [
      normalizeAppearanceToken(alias),
      normalizeAppearanceToken(target),
    ]),
  );
  return normalizedAliases.get(normalized) ?? normalized;
}

/** Resolve every persisted dimension through the injected catalog and aliases. */
export function normalizeAppearancePreferences(
  catalog: AppearanceCatalog,
  preferences: AppearancePreferenceInput,
): AppearancePreferences {
  const themeId = aliasTarget(preferences.themeId, catalog.aliases.themes);
  const fontId = aliasTarget(preferences.fontId, catalog.aliases.fonts);
  const fontSizeId = aliasTarget(
    preferences.fontSizeId,
    catalog.aliases.fontSizes,
  );
  const mode = preferences.mode;

  return {
    themeId:
      catalog.themes.find(
        (theme) => normalizeAppearanceToken(theme.metadata.id) === themeId,
      )?.metadata.id ?? catalog.defaults.themeId,
    fontId:
      catalog.fonts.find((font) => normalizeAppearanceToken(font.id) === fontId)
        ?.id ?? catalog.defaults.fontId,
    fontSizeId:
      catalog.fontSizes.find(
        (size) => normalizeAppearanceToken(size.id) === fontSizeId,
      )?.id ?? catalog.defaults.fontSizeId,
    mode: catalog.modes.includes(mode as AppearanceMode)
      ? (mode as AppearanceMode)
      : catalog.defaults.mode,
  };
}
