/**
 * Color system types for the theme package.
 *
 * Uses OKLCH color space with 13-stop color scales,
 * inspired by StyleGlide and Tailwind CSS v4.
 */

/**
 * OKLCH color components.
 */
export interface OklchColor {
  /** Lightness: 0 to 1 */
  l: number;
  /** Chroma: 0 to ~0.4 */
  c: number;
  /** Hue: 0 to 360 */
  h: number;
}

/**
 * 13-stop OKLCH color scale.
 * Stops follow Tailwind convention from lightest (25) to darkest (1000).
 * All values are CSS oklch() strings, e.g. "oklch(0.97 0.01 264)"
 */
export interface ColorScale {
  25: string;
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
  1000: string;
}

export type ColorScaleStop = keyof ColorScale;

/**
 * Palette category for organization and filtering.
 */
export type PaletteCategory =
  | 'neutral'
  | 'warm'
  | 'cool'
  | 'vibrant'
  | 'pastel'
  | 'nature'
  | 'corporate';

/**
 * Complete palette definition with dual color scales and semantic mapping.
 */
export interface PaletteDefinition {
  /** Unique palette identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Category for grouping in the UI */
  category: PaletteCategory;
  /** Short description */
  description: string;
  /** Preview colors for the palette selector */
  preview: {
    primary: string;
    secondary: string;
    accent: string;
  };
  /** Neutral/grayscale color scale (backgrounds, text, borders) */
  base: ColorScale;
  /** Primary brand color scale */
  primary: ColorScale;
  /** Maps color scale stops to CSS semantic variables for light mode */
  semanticMapping: {
    light: SemanticColorMapping;
    dark: SemanticColorMapping;
  };
}

/**
 * Maps semantic CSS variable tokens to color scale stops.
 * This bridges the 13-stop scale system with the existing
 * ~25 CSS custom properties used by the UI.
 */
export interface SemanticColorMapping {
  '--background': ScaleRef;
  '--foreground': ScaleRef;
  '--card': ScaleRef;
  '--card-foreground': ScaleRef;
  '--popover': ScaleRef;
  '--popover-foreground': ScaleRef;
  '--primary': ScaleRef;
  '--primary-foreground': ScaleRef;
  '--secondary': ScaleRef;
  '--secondary-foreground': ScaleRef;
  '--muted': ScaleRef;
  '--muted-foreground': ScaleRef;
  '--accent': ScaleRef;
  '--accent-foreground': ScaleRef;
  '--destructive': ScaleRef;
  '--destructive-foreground': ScaleRef;
  '--border': ScaleRef;
  '--input': ScaleRef;
  '--ring': ScaleRef;
}

/**
 * Reference to a color in a scale at a specific stop.
 * Can also be a direct OKLCH string for colors that
 * don't fit neatly into the scale (e.g., destructive).
 */
export type ScaleRef =
  | { scale: 'base' | 'primary'; stop: ColorScaleStop }
  | { direct: string };

/**
 * CSS variable keys used by the runtime theme system.
 * These must match the existing ThemeColorVariables interface.
 */
export interface ThemeColorVariables {
  '--background': string;
  '--foreground': string;
  '--card': string;
  '--card-foreground': string;
  '--popover': string;
  '--popover-foreground': string;
  '--primary': string;
  '--primary-foreground': string;
  '--secondary': string;
  '--secondary-foreground': string;
  '--muted': string;
  '--muted-foreground': string;
  '--accent': string;
  '--accent-foreground': string;
  '--destructive': string;
  '--destructive-foreground': string;
  '--destructive-border': string;
  '--success': string;
  '--success-foreground': string;
  '--success-border': string;
  '--warning': string;
  '--warning-foreground': string;
  '--warning-border': string;
  '--info': string;
  '--info-foreground': string;
  '--info-border': string;
  '--border': string;
  '--input': string;
  '--ring': string;
  /** Optional product-derived action role; source palette tokens remain unchanged. */
  '--action'?: string;
  '--action-foreground'?: string;
  '--checkbox-border': string;
  '--checkbox-background': string;
  '--checkbox-checked-background': string;
  '--checkbox-checked-foreground': string;
  '--radius': string;
  '--chart-1': string;
  '--chart-2': string;
  '--chart-3': string;
  '--chart-4': string;
  '--chart-5': string;
  '--sidebar-background'?: string;
  '--sidebar-foreground'?: string;
  '--sidebar-primary'?: string;
  '--sidebar-primary-foreground'?: string;
  '--sidebar-accent'?: string;
  '--sidebar-accent-foreground'?: string;
  '--sidebar-border'?: string;
  '--sidebar-ring'?: string;
}

/**
 * Resolved color variables for a palette in a specific mode (light/dark).
 */
export type ResolvedPaletteColors = ThemeColorVariables;
