/**
 * Color Token Interfaces
 *
 * Defines the color system for PressedMail themes.
 * All colors should be valid CSS color values (hex, rgb, hsl, etc.)
 */

/**
 * Complete theme color palette
 */
export interface ThemeColors {
  // Primary palette
  primary: string;
  primaryForeground: string;
  primaryHover: string;
  primaryActive: string;

  // Secondary palette
  secondary: string;
  secondaryForeground: string;
  secondaryHover: string;

  // Accent colors
  accent: string;
  accentForeground: string;

  // Background colors
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;

  // Muted colors
  muted: string;
  mutedForeground: string;

  // Border and input
  border: string;
  input: string;
  ring: string;

  // Semantic colors
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  error: string;
  errorForeground: string;
  info: string;
  infoForeground: string;

  // Email-specific colors
  unread: string;
  starred: string;
  important: string;
  selected: string;
  hover: string;
}

/**
 * Dark mode color overrides
 * All properties are optional - only include overrides needed for dark mode
 */
export type ThemeColorsDark = Partial<ThemeColors>;

/**
 * Whitelabel color overrides (subset of colors that agencies can customize)
 */
export interface WhitelabelColors {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  foreground?: string;
  card?: string;
  border?: string;
}

/**
 * Default color values for fallbacks
 */
export const DEFAULT_THEME_COLORS: ThemeColors = {
  // Primary palette
  primary: "#0f91b2",
  primaryForeground: "#eafdfe",
  primaryHover: "#0e83a0",
  primaryActive: "#0c748e",

  // Secondary palette
  secondary: "#eff1f3",
  secondaryForeground: "#081526",
  secondaryHover: "#d7dde0",

  // Accent colors
  accent: "#eef3f7",
  accentForeground: "#081526",

  // Background colors
  background: "#f6f9fb",
  foreground: "#081526",
  card: "#ffffff",
  cardForeground: "#081526",
  popover: "#ffffff",
  popoverForeground: "#081526",

  // Muted colors
  muted: "#eff1f3",
  mutedForeground: "#3b4f69",

  // Border and input
  border: "#d7dde0",
  input: "#d7dde0",
  ring: "#5184ab",

  // Semantic colors
  success: "#1c882d",
  successForeground: "#ffffff",
  warning: "#edb417",
  warningForeground: "#081526",
  error: "#e7000b",
  errorForeground: "#ffffff",
  info: "#0f91b2",
  infoForeground: "#eafdfe",

  // Email-specific colors
  unread: "#eef3f7",
  starred: "#edb417",
  important: "#edb417",
  selected: "#d6eef5",
  hover: "#eef3f7",
};

/**
 * Utility type for color keys
 */
export type ThemeColorKey = keyof ThemeColors;
