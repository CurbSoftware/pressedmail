import React, {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  type AppearanceMatchMedia,
  normalizeAppearancePreferences,
  observeAppearanceMode,
  resolveAppearanceMode,
} from '../appearance';
import {
  type AppearanceTargets,
  mountAppearanceTargets,
} from '../appearance/targets';
import {
  type OverrideCssOptions,
  applyOverrideCss,
} from '../css/override-generator';
import { ThemeRegistry } from '../registry/theme-registry';
import type { ThemeColorVariables } from '../types/colors';
import type { FontConfig } from '../types/fonts';
import type {
  AppearanceCatalog,
  AppearanceMode,
  AppearancePreferenceInput,
  AppearancePreferences,
  ResolvedAppearanceMode,
} from '../types/preferences';
import type { TierId } from '../types/tier';
import { ThemeContext, type ThemeContextValue } from './ThemeContext';

export interface ThemeProviderProps {
  children: ReactNode;
  /** Complete product-owned theme, font, size, mode, alias, and default data. */
  catalog: AppearanceCatalog;
  /** Explicit app and portal roots. No document-wide fallback is used. */
  targets: AppearanceTargets;
  userTier?: TierId;
  initialPreferences?: AppearancePreferenceInput;
  onPreferencesChange?: (preferences: AppearancePreferences) => void;
  onThemeChange?: (themeId: string) => void;
  variableOverrides?: Partial<ThemeColorVariables> | null;
  /** Opt in to Tailwind static-color overrides with explicit selectors. */
  overrideCss?: false | OverrideCssOptions;
  /** Injectable for tests or hosts with their own media-query environment. */
  matchMedia?: AppearanceMatchMedia;
}

function readInitialMode(
  mode: AppearanceMode,
  matchMedia?: AppearanceMatchMedia,
): ResolvedAppearanceMode {
  if (mode !== 'system') return mode;
  const matcher =
    matchMedia ??
    (typeof window !== 'undefined' && window.matchMedia
      ? (query: string) => window.matchMedia(query)
      : undefined);
  return resolveAppearanceMode(
    mode,
    matcher?.('(prefers-color-scheme: dark)').matches ?? false,
  );
}

export function ThemeProvider({
  children,
  catalog,
  targets,
  userTier = 'free',
  initialPreferences,
  onPreferencesChange,
  onThemeChange,
  variableOverrides,
  overrideCss = false,
  matchMedia,
}: ThemeProviderProps) {
  const [preferences, setPreferencesState] = useState<AppearancePreferences>(
    () =>
      normalizeAppearancePreferences(catalog, {
        ...catalog.defaults,
        ...initialPreferences,
      }),
  );
  const [systemMode, setSystemMode] = useState<ResolvedAppearanceMode>(() =>
    readInitialMode('system', matchMedia),
  );
  const committedPreferencesRef = useRef(preferences);
  const resolvedMode =
    preferences.mode === 'system' ? systemMode : preferences.mode;

  useEffect(() => {
    if (committedPreferencesRef.current === preferences) return;
    committedPreferencesRef.current = preferences;
    onPreferencesChange?.(preferences);
  }, [onPreferencesChange, preferences]);

  const registry = useMemo(
    () =>
      new ThemeRegistry({
        themes: catalog.themes,
        defaultThemeId: catalog.defaults.themeId,
        aliases: catalog.aliases.themes,
      }),
    [catalog],
  );

  const currentTheme = useMemo(() => {
    const preferred = registry.get(preferences.themeId);
    if (
      preferred &&
      registry.isAvailableForTier(preferred.metadata.id, userTier)
    ) {
      return preferred;
    }
    const fallback = registry.get(catalog.defaults.themeId);
    if (
      fallback &&
      registry.isAvailableForTier(fallback.metadata.id, userTier)
    ) {
      return fallback;
    }
    const firstAvailable = registry.getAvailableForTier(userTier)[0];
    if (!firstAvailable) {
      throw new Error(
        `Appearance catalog has no theme available for tier "${userTier}".`,
      );
    }
    return firstAvailable;
  }, [catalog.defaults.themeId, preferences.themeId, registry, userTier]);

  const font =
    catalog.fonts.find((item) => item.id === preferences.fontId) ??
    catalog.fonts.find((item) => item.id === catalog.defaults.fontId);
  const fontSize =
    catalog.fontSizes.find((item) => item.id === preferences.fontSizeId) ??
    catalog.fontSizes.find((item) => item.id === catalog.defaults.fontSizeId);

  if (!font || !fontSize) {
    throw new Error(
      'Appearance catalog defaults must reference registered font and size values.',
    );
  }

  const isDark = resolvedMode === 'dark';
  const resolvedTheme = useMemo(
    () => registry.resolve(currentTheme.metadata.id, userTier, isDark),
    [currentTheme.metadata.id, isDark, registry, userTier],
  );
  const effectiveVariables = useMemo(
    () =>
      ({
        ...resolvedTheme.effectiveVariables,
        ...(variableOverrides ?? {}),
      }) as ThemeColorVariables,
    [resolvedTheme.effectiveVariables, variableOverrides],
  );
  const fontConfig = useMemo<FontConfig>(
    () => ({
      display: { family: font.family, weight: '600' },
      text: { family: font.family, weight: '400' },
    }),
    [font.family],
  );

  useEffect(() => {
    if (preferences.mode !== 'system') return;
    const matcher =
      matchMedia ??
      (typeof window !== 'undefined' && window.matchMedia
        ? (query: string) => window.matchMedia(query)
        : undefined);
    if (!matcher) return;
    return observeAppearanceMode('system', setSystemMode, matcher);
  }, [matchMedia, preferences.mode]);

  useEffect(
    () =>
      mountAppearanceTargets(
        {
          themeId: currentTheme.metadata.id,
          themeClass: currentTheme.cssClass,
          mode: resolvedMode,
          fontId: font.id,
          fontFamily: font.family,
          fontSizeId: fontSize.id,
          fontSizeValue: fontSize.value,
          variables: effectiveVariables,
        },
        targets,
      ),
    [
      currentTheme.cssClass,
      currentTheme.metadata.id,
      effectiveVariables,
      font.family,
      font.id,
      fontSize.id,
      fontSize.value,
      resolvedMode,
      targets,
    ],
  );

  useEffect(() => {
    if (!overrideCss) return;
    return applyOverrideCss(effectiveVariables, overrideCss);
  }, [effectiveVariables, overrideCss]);

  const setPreferences = useCallback(
    (partial: Partial<AppearancePreferences>) => {
      setPreferencesState((previous) => {
        return normalizeAppearancePreferences(catalog, {
          ...previous,
          ...partial,
        });
      });
    },
    [catalog],
  );

  const isThemeAvailable = useCallback(
    (themeId: string) => {
      const theme = registry.get(themeId);
      return Boolean(
        theme && registry.isAvailableForTier(theme.metadata.id, userTier),
      );
    },
    [registry, userTier],
  );
  const availableThemes = useMemo(
    () => registry.getPublicForTier(userTier),
    [registry, userTier],
  );

  const setTheme = useCallback(
    (themeId: string) => {
      const theme = registry.get(themeId);
      if (!theme || !isThemeAvailable(theme.metadata.id)) return;
      setPreferences({ themeId: theme.metadata.id });
      onThemeChange?.(theme.metadata.id);
    },
    [isThemeAvailable, onThemeChange, registry, setPreferences],
  );

  const setMode = useCallback(
    (mode: AppearanceMode) => setPreferences({ mode }),
    [setPreferences],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      currentThemeId: currentTheme.metadata.id,
      setTheme,
      resolvedTheme,
      effectiveVariables,
      mode: preferences.mode,
      resolvedMode,
      setMode,
      isDark,
      userTier,
      availableThemes,
      availableThemeIds: availableThemes.map((theme) => theme.metadata.id),
      isThemeAvailable,
      font,
      fontConfig,
      fontSize,
      preferences,
      setPreferences,
    }),
    [
      currentTheme.metadata.id,
      availableThemes,
      effectiveVariables,
      font,
      fontConfig,
      fontSize,
      isDark,
      isThemeAvailable,
      preferences,
      resolvedMode,
      resolvedTheme,
      setMode,
      setPreferences,
      setTheme,
      userTier,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
