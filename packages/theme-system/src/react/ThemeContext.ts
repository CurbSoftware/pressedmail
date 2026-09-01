import { createContext } from 'react';

import type { ThemeColorVariables } from '../types/colors';
import type {
  FontConfig,
  SemanticFontDefinition,
  SemanticFontSizeDefinition,
} from '../types/fonts';
import type {
  AppearanceMode,
  AppearancePreferences,
  ResolvedAppearanceMode,
} from '../types/preferences';
import type { ResolvedTheme, ThemeDefinition } from '../types/theme';
import type { TierId } from '../types/tier';

export interface ThemeContextValue {
  currentThemeId: string;
  setTheme: (themeId: string) => void;
  resolvedTheme: ResolvedTheme;
  effectiveVariables: ThemeColorVariables;
  mode: AppearanceMode;
  resolvedMode: ResolvedAppearanceMode;
  setMode: (mode: AppearanceMode) => void;
  isDark: boolean;
  userTier: TierId;
  availableThemes: readonly ThemeDefinition[];
  availableThemeIds: string[];
  isThemeAvailable: (themeId: string) => boolean;
  font: SemanticFontDefinition;
  fontConfig: FontConfig;
  fontSize: SemanticFontSizeDefinition;
  preferences: AppearancePreferences;
  setPreferences: (preferences: Partial<AppearancePreferences>) => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);
