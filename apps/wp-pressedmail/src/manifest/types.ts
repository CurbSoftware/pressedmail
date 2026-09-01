/**
 * Manifest Types
 *
 * TypeScript type definitions for the plugin manifest.
 * These types mirror the structure of manifest.json.
 *
 * @since 2.0.0
 */

export interface ManifestLayoutPreview {
  sidebar: string;
  list: string;
  content: string;
}

export interface ManifestLayout {
  id: string;
  name: string;
  description: string;
  requiresPro: boolean;
  php: {
    class: string;
  };
  react: {
    module: string;
    entry: string;
  };
  preview: ManifestLayoutPreview;
}

export interface ManifestThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

export interface ManifestTheme {
  id: string;
  name: string;
  requiresPro: boolean;
  category: "free" | "pro";
  colors: {
    light: ManifestThemeColors;
    dark: ManifestThemeColors;
  };
}

export interface ManifestFeature {
  id: string;
  name: string;
  description: string;
  php_class: string;
  requires_license: boolean;
  category: string;
  extended_only?: boolean;
}

export interface ManifestBuildFeatureFlags {
  isPro: boolean;
  entitlements: Record<string, boolean | string>;
  features: Record<
    string,
    boolean | { enabled: boolean; [key: string]: unknown }
  >;
}

export interface ManifestBuildConfig {
  variant: "free" | "pro";
  slug: string;
  name: string;
  description: string;
  constants: Record<string, boolean | string>;
  devConstants: Record<string, boolean | string>;
  exclude_php: string[];
  exclude_react: string[];
  fileRenames?: Record<string, string>;
  replacements?: Record<string, Record<string, string>>;
  featureFlags: ManifestBuildFeatureFlags;
}

export interface Manifest {
  $schema?: string;
  version: string;
  layouts: Record<string, ManifestLayout>;
  themes: Record<string, ManifestTheme>;
  features: {
    core: Record<string, ManifestFeature>;
    // 'premium' is the shared cross-plugin FeatureManager registry bucket key.
    premium: Record<string, ManifestFeature>;
  };
  build: {
    free: ManifestBuildConfig;
    pro: ManifestBuildConfig;
  };
  baseIncludes: string[];
  alwaysExclude: string[];
}

export type LayoutId = "pressedm" | "pressedg" | "pressedout";
export type ThemeId =
  | "pressedm"
  | "curb"
  | "pretty"
  | "pressedg"
  | "pressedout"
  | "pressedcube"
  | "tokyo"
  | "executive"
  | "minimalist"
  | "contrast";
