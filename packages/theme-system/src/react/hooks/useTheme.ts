/**
 * Core theme hook.
 *
 * Provides access to the full ThemeContextValue.
 */
import { useContext } from 'react';

import { ThemeContext, type ThemeContextValue } from '../ThemeContext';

/**
 * Access the theme context.
 * Must be used inside a ThemeProvider.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
