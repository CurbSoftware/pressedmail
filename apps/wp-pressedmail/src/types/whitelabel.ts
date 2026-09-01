export const WHITELABEL_SETTINGS_VERSION = 1 as const;
export const BRAND_THEME_ID = "brand" as const;

export const APPEARANCE_MODES = ["system", "light", "dark"] as const;
export type AppearanceMode = (typeof APPEARANCE_MODES)[number];

export const INBOX_LAYOUTS = ["pressedm", "pressedg", "pressedout"] as const;
export type InboxLayout = (typeof INBOX_LAYOUTS)[number];

export const RADIUS_PRESETS = ["subtle", "standard", "rounded"] as const;
export type RadiusPreset = (typeof RADIUS_PRESETS)[number];

export type HexColor = `#${string}`;

export interface GuidedBrandPalette {
  primary: HexColor;
  secondary: HexColor;
  accent: HexColor;
  background: HexColor;
  foreground: HexColor;
  radius: RadiusPreset;
}

export interface WhitelabelSettingsV1 {
  version: typeof WHITELABEL_SETTINGS_VERSION;
  enabled: boolean;
  brand_name: string;
  assets: {
    logo_on_light_id: number | null;
    logo_on_dark_id: number | null;
    square_mark_id: number | null;
  };
  hide_powered_by: boolean;
  support_url: string;
  documentation_url: string;
  appearance: {
    base_theme: string;
    light: GuidedBrandPalette;
    dark: GuidedBrandPalette;
    default_mode: AppearanceMode;
    allow_user_mode_switching: boolean;
    allow_user_theme_switching: boolean;
    default_layout: InboxLayout;
    allow_user_layout_switching: boolean;
  };
}

export interface EffectiveWhitelabelRuntime {
  version: typeof WHITELABEL_SETTINGS_VERSION;
  revision: string;
  enabled: true;
  brand_name: string;
  assets: {
    logo_on_light_url: string | null;
    logo_on_dark_url: string | null;
    square_mark_url: string | null;
    pwa_192_url: string | null;
    pwa_512_url: string | null;
  };
  hide_powered_by: boolean;
  support_url: string | null;
  documentation_url: string | null;
  appearance: {
    theme_id: typeof BRAND_THEME_ID;
    base_theme: string;
    light_palette: GuidedBrandPalette;
    dark_palette: GuidedBrandPalette;
    default_mode: AppearanceMode;
    allow_user_mode_switching: boolean;
    allow_user_theme_switching: boolean;
    default_layout: InboxLayout;
    allow_user_layout_switching: boolean;
  };
}

import type { ThemeColorVariables } from "@/components/themes/theme-variables";

/**
 * Return type for useWhitelabelTheme hook.
 */
export interface UseWhitelabelThemeReturn {
  /** Theme color tokens for light/dark modes */
  themeTokens: {
    light: Partial<ThemeColorVariables>;
    dark: Partial<ThemeColorVariables>;
  };
  /** Whether whitelabel mode is enabled */
  isWhitelabelEnabled: boolean;

  // Branding
  /** Custom logo URL (for dark backgrounds) */
  logo: string | null;
  /** Custom logo URL for light backgrounds */
  logoLight: string | null;
  /** Custom plugin name */
  pluginName: string;
  /** Whether to hide the product brand in the application footer */
  hidePoweredBy: boolean;
  /** Square mark used by compact and PWA-facing surfaces. */
  squareMark: string | null;
  /** Effective support destination. */
  supportUrl: string | null;
  /** Effective documentation destination. */
  documentationUrl: string | null;

  // Theme restrictions
  /** Whether pro color palettes are disabled */
  areProPalettesDisabled: boolean;
  /** Whether users can switch layouts */
  allowLayoutSwitching: boolean;
  /** Whether users can switch themes */
  allowThemeSwitching: boolean;
  /** Whether users can switch light/dark/system appearance. */
  allowModeSwitching: boolean;

  // Default settings
  /** Default layout for whitelabel mode */
  defaultLayout: string;
  /** Default theme for whitelabel mode */
  defaultTheme: string;
  /** Administrator default light/dark/system mode. */
  defaultMode: AppearanceMode;

  // CSS variable generation
  /** Get CSS variables as a Record for inline styles */
  getCSSVariables: (mode: "light" | "dark") => Record<string, string>;
  /** Get CSS variables as a style string */
  getCSSVariablesString: (mode: "light" | "dark") => string;
  /** Apply CSS variables to a target element */
  applyCSSVariables: (element: HTMLElement, mode: "light" | "dark") => void;
}
