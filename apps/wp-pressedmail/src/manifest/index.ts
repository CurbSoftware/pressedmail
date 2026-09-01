/**
 * Manifest Loader
 *
 * Provides access to the plugin manifest data.
 * This is the single source of truth for layouts, themes, and feature information.
 *
 * @since 2.0.0
 */

import manifestData from "../../manifest.json";
import type {
  Manifest,
  ManifestLayout,
  ManifestTheme,
  ManifestFeature,
  LayoutId,
  ThemeId,
} from "./types";

// Type assertion for the manifest data
export const manifest = manifestData as Manifest;

// ============================================================================
// Layout Utilities
// ============================================================================

/**
 * Get all layouts.
 */
export function getLayouts(): Record<string, ManifestLayout> {
  return manifest.layouts;
}

/**
 * Get a layout by ID.
 */
export function getLayout(layoutId: string): ManifestLayout | undefined {
  return manifest.layouts[layoutId];
}

/**
 * Get all layout IDs.
 */
export function getLayoutIds(): LayoutId[] {
  return Object.keys(manifest.layouts) as LayoutId[];
}

/**
 * Get layout preview configurations (for UI rendering).
 */
export function getLayoutPreviews(): Array<{
  id: LayoutId;
  name: string;
  preview: ManifestLayout["preview"];
}> {
  return Object.entries(manifest.layouts).map(([id, layout]) => ({
    id: id as LayoutId,
    name: layout.name,
    preview: layout.preview,
  }));
}

// ============================================================================
// Theme Utilities
// ============================================================================

/**
 * Get all themes.
 */
export function getThemes(): Record<string, ManifestTheme> {
  return manifest.themes;
}

/**
 * Get a theme by ID.
 */
export function getTheme(themeId: string): ManifestTheme | undefined {
  return manifest.themes[themeId];
}

/**
 * Get all theme IDs.
 */
export function getThemeIds(): ThemeId[] {
  return Object.keys(manifest.themes) as ThemeId[];
}

/**
 * Get themes by category.
 */
export function getThemesByCategory(category: "free" | "pro"): ManifestTheme[] {
  return Object.values(manifest.themes).filter(
    (theme) => theme.category === category,
  );
}

// ============================================================================
// Feature Utilities
// ============================================================================

/**
 * Get a feature by ID.
 */
export function getFeature(featureId: string): ManifestFeature | undefined {
  return (
    manifest.features.core[featureId] ?? manifest.features.premium[featureId]
  );
}

/**
 * Get all features (optionally filtered by variant).
 */
export function getFeatures(
  variant: "free" | "pro" = "pro",
): ManifestFeature[] {
  const core = Object.values(manifest.features.core);

  if (variant === "pro") {
    const premium = Object.values(manifest.features.premium);
    return [...core, ...premium];
  }

  return core;
}

// ============================================================================
// Build Config Utilities
// ============================================================================

/**
 * Get build configuration for a variant.
 */
export function getBuildConfig(
  variant: "free" | "pro",
): (typeof manifest.build)[typeof variant] {
  return manifest.build[variant];
}

/**
 * Get feature flags for a variant.
 */
export function getFeatureFlags(variant: "free" | "pro") {
  return manifest.build[variant].featureFlags;
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  Manifest,
  ManifestLayout,
  ManifestTheme,
  ManifestFeature,
  LayoutId,
  ThemeId,
} from "./types";
