import type {
  SemanticFontDefinition,
  SemanticFontSizeDefinition,
  SemanticFontSizeId,
} from './fonts';
import type { ThemeDefinition } from './theme';

export type AppearanceMode = 'system' | 'light' | 'dark';
export type ResolvedAppearanceMode = Exclude<AppearanceMode, 'system'>;

/** All persisted appearance dimensions use stable semantic identifiers. */
export interface AppearancePreferences {
  themeId: string;
  fontId: string;
  fontSizeId: SemanticFontSizeId;
  mode: AppearanceMode;
}

/** Untrusted stored values accepted before catalog and alias normalization. */
export interface AppearancePreferenceInput {
  themeId?: string;
  fontId?: string;
  fontSizeId?: string;
  mode?: string;
}

export interface AppearanceAliases {
  themes?: Readonly<Record<string, string>>;
  fonts?: Readonly<Record<string, string>>;
  fontSizes?: Readonly<Record<string, SemanticFontSizeId>>;
}

/**
 * Product-owned catalog injected into the neutral resolver and provider.
 * Theme names, palettes, font stacks, tiers, and aliases stay with products.
 */
export interface AppearanceCatalog<
  TLayout = unknown,
  TComponents = unknown,
  TPages = unknown,
> {
  themes: readonly ThemeDefinition<TLayout, TComponents, TPages>[];
  fonts: readonly SemanticFontDefinition[];
  fontSizes: readonly SemanticFontSizeDefinition[];
  modes: readonly AppearanceMode[];
  aliases: AppearanceAliases;
  defaults: AppearancePreferences;
}
