/**
 * Core theme definition types.
 *
 * ThemeDefinition is generic so a consuming product can extend it with its
 * own layout, component, and page configuration types.
 */
import type { ComponentType } from 'react';

import type { PaletteDefinition, ThemeColorVariables } from './colors';
import type { FontConfig } from './fonts';
import type { ThemeTierAccess } from './tier';

/**
 * Theme category for grouping and display.
 */
export type ThemeCategory = 'free' | 'starter' | 'pro' | 'agency';

/**
 * Theme metadata for display in the UI.
 */
export interface ThemeMetadata {
  id: string;
  name: string;
  description: string;
  previewColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  icon?: ComponentType<{ className?: string }>;
  category: ThemeCategory;
  tags?: string[];
  /** Compatibility definitions resolve stored values but stay out of pickers. */
  isHidden?: boolean;
}

/**
 * Complete theme definition.
 *
 * Generic type parameters allow the plugin to extend with its own types:
 * - TLayout: inbox/settings/calendar layout configuration
 * - TComponents: component variant styling (button, card, badge, etc.)
 * - TPages: page-specific theme tokens (inbox, calendar, contacts, etc.)
 */
export interface ThemeDefinition<
  TLayout = unknown,
  TComponents = unknown,
  TPages = unknown,
> {
  metadata: ThemeMetadata;
  access: ThemeTierAccess;
  /** Optional construction metadata for scale-based palette tooling. */
  palette?: PaletteDefinition;
  /** Optional legacy dual-font metadata; appearance catalogs own UI fonts. */
  font?: FontConfig;
  /** Optional construction metadata for palette tooling. */
  borderRadius?: string;
  /** CSS class applied to the theme root */
  cssClass: string;
  /** Pre-resolved light mode CSS variables (for backward compatibility) */
  lightVariables: ThemeColorVariables;
  /** Pre-resolved dark mode CSS variables (for backward compatibility) */
  darkVariables: ThemeColorVariables;
  /** Plugin-specific layout configuration */
  layout?: TLayout;
  /** Plugin-specific component variant styling */
  components?: TComponents;
  /** Plugin-specific page theme tokens */
  pages?: TPages;
}

/**
 * Resolved theme with computed values for the current mode.
 */
export interface ResolvedTheme<
  TLayout = unknown,
  TComponents = unknown,
  TPages = unknown,
> extends ThemeDefinition<TLayout, TComponents, TPages> {
  /** Whether the theme is available for the current tier */
  isAvailable: boolean;
  /** Whether dark mode is active */
  isDark: boolean;
  /** The effective CSS variables for the current mode */
  effectiveVariables: ThemeColorVariables;
}
