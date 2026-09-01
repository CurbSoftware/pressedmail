import { useCallback } from 'react';

import type { SemanticFontSizeId } from '../../types/fonts';
import type {
  AppearanceMode,
  AppearancePreferences,
} from '../../types/preferences';
import { useTheme } from './useTheme';

export interface UseAppearancePreferencesResult {
  preferences: AppearancePreferences;
  setTheme: (themeId: string) => void;
  setFont: (fontId: string) => void;
  setFontSize: (fontSizeId: SemanticFontSizeId) => void;
  setMode: (mode: AppearanceMode) => void;
}

export function useAppearancePreferences(): UseAppearancePreferencesResult {
  const { preferences, setPreferences, setTheme, setMode } = useTheme();
  const setFont = useCallback(
    (fontId: string) => setPreferences({ fontId }),
    [setPreferences],
  );
  const setFontSize = useCallback(
    (fontSizeId: SemanticFontSizeId) => setPreferences({ fontSizeId }),
    [setPreferences],
  );

  return { preferences, setTheme, setFont, setFontSize, setMode };
}
