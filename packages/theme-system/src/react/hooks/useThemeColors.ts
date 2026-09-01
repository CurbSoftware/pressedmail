/**
 * Theme colors hook.
 *
 * Returns the currently active CSS color variables.
 */
import type { ThemeColorVariables } from '../../types/colors';
import { useTheme } from './useTheme';

/**
 * Get the current effective CSS color variables.
 * Returns null before the theme is resolved.
 */
export function useThemeColors(): ThemeColorVariables | null {
  const { effectiveVariables } = useTheme();
  return effectiveVariables;
}
