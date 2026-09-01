/**
 * @kit/theme-system
 *
 * Product-neutral appearance machinery.
 * Injected catalogs, OKLCH color scales, typography, and scoped runtime CSS.
 */

// ---- Types ----
export type {
  OklchColor,
  ColorScale,
  ColorScaleStop,
  PaletteCategory,
  PaletteDefinition,
  SemanticColorMapping,
  ScaleRef,
  ThemeColorVariables,
  ResolvedPaletteColors,
} from './types/colors';

export type {
  FontSelection,
  FontConfig,
  FontPresetCategory,
  FontPreset,
  SemanticFontDefinition,
  SemanticFontSizeDefinition,
  SemanticFontSizeId,
} from './types/fonts';
export { SEMANTIC_FONT_SIZES } from './types/fonts';

export type {
  ThemeCategory,
  ThemeMetadata,
  ThemeDefinition,
  ResolvedTheme,
} from './types/theme';

export type { TierId, ThemeTierAccess } from './types/tier';
export { TierPriority, isTierAtLeast } from './types/tier';

export type {
  AppearanceAliases,
  AppearanceCatalog,
  AppearanceMode,
  AppearancePreferenceInput,
  AppearancePreferences,
  ResolvedAppearanceMode,
} from './types/preferences';

// ---- Appearance resolution ----
export {
  normalizeAppearancePreferences,
  normalizeAppearanceToken,
  observeAppearanceMode,
  resolveAppearanceMode,
  type AppearanceMatchMedia,
  type AppearanceMediaQuery,
  mountAppearanceTargets,
  type AppearanceTargets,
  type AppearanceTargetState,
} from './appearance';

// ---- Colors ----
export {
  parseOklch,
  formatOklch,
  adjustLightness,
  adjustChroma,
  withOpacity,
} from './colors/oklch';
export {
  generatePrimaryScale,
  generateNeutralScale,
  generateScalesFromHue,
} from './colors/color-scale';
export { resolveSemanticColors } from './colors/semantic-mapper';
// ---- Fonts ----
export {
  generateFontFaceCss,
  loadFonts,
  unloadFonts,
  type FontAssetDefinition,
  type FontAssetFace,
  type FontLoaderOptions,
} from './fonts/font-loader';
export {
  generateFontCss,
  applyFontCss,
  clearFontCss,
  type FontCssOptions,
} from './fonts/font-css';

// ---- CSS injection ----
export {
  upsertStyleElement,
  removeStyleElement,
  replaceStyleElement,
} from './css/style-manager';
export {
  injectVariables,
  clearVariables,
  type VariableTargets,
} from './css/variable-injector';
export {
  generateOverrideCss,
  applyOverrideCss,
  clearOverrideCss,
  type OverrideCssOptions,
} from './css/override-generator';

// ---- Registry ----
export {
  ThemeRegistry,
  type ThemeRegistryOptions,
} from './registry/theme-registry';
