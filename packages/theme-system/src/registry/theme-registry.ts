/**
 * Enhanced theme registry.
 *
 * Central store for ThemeDefinition records.
 * Provides lookup, tier-based access, category grouping,
 * and theme resolution with light/dark mode CSS variables.
 */
import { normalizeAppearanceToken } from '../appearance/catalog';
import type { PaletteCategory, ThemeColorVariables } from '../types/colors';
import type {
  ResolvedTheme,
  ThemeCategory,
  ThemeDefinition,
} from '../types/theme';
import type { TierId } from '../types/tier';

export interface ThemeRegistryOptions<
  TLayout = unknown,
  TComponents = unknown,
  TPages = unknown,
> {
  themes?: readonly ThemeDefinition<TLayout, TComponents, TPages>[];
  defaultThemeId?: string;
  aliases?: Readonly<Record<string, string>>;
}

/**
 * Theme Registry: manages registered ThemeDefinitions.
 *
 * Generic type parameters mirror ThemeDefinition so consuming
 * products can register extended definitions.
 */
export class ThemeRegistry<
  TLayout = unknown,
  TComponents = unknown,
  TPages = unknown,
> {
  private themes = new Map<
    string,
    ThemeDefinition<TLayout, TComponents, TPages>
  >();
  private defaultThemeId = 'default';
  private aliases = new Map<string, string>();

  constructor(
    options: ThemeRegistryOptions<TLayout, TComponents, TPages> = {},
  ) {
    this.aliases = new Map(
      Object.entries(options.aliases ?? {}).map(([alias, target]) => [
        normalizeAppearanceToken(alias),
        normalizeAppearanceToken(target),
      ]),
    );
    this.registerAll(options.themes ?? []);
    if (options.defaultThemeId) {
      this.setDefaultTheme(options.defaultThemeId);
    }
  }

  /** Resolve direct and legacy identifiers through the injected alias policy. */
  resolveId(themeId: string): string {
    const normalized = normalizeAppearanceToken(themeId);
    return this.aliases.get(normalized) ?? normalized;
  }

  /** Register a single theme. */
  register(theme: ThemeDefinition<TLayout, TComponents, TPages>): void {
    this.themes.set(normalizeAppearanceToken(theme.metadata.id), theme);
  }

  /** Register multiple themes at once. */
  registerAll(
    themes: readonly ThemeDefinition<TLayout, TComponents, TPages>[],
  ): void {
    for (const theme of themes) {
      this.register(theme);
    }
  }

  /** Get a theme by ID. */
  get(
    themeId: string,
  ): ThemeDefinition<TLayout, TComponents, TPages> | undefined {
    return this.themes.get(this.resolveId(themeId));
  }

  /** Get the default theme (throws if not registered). */
  getDefault(): ThemeDefinition<TLayout, TComponents, TPages> {
    const theme = this.themes.get(this.defaultThemeId);
    if (!theme) {
      throw new Error(`Default theme "${this.defaultThemeId}" not registered.`);
    }
    return theme;
  }

  /** Get all registered themes. */
  getAll(): ThemeDefinition<TLayout, TComponents, TPages>[] {
    return Array.from(this.themes.values());
  }

  /** Get all registered theme IDs. */
  getAllIds(): string[] {
    return Array.from(this.themes.keys());
  }

  /** Check if a theme is registered. */
  has(themeId: string): boolean {
    return this.themes.has(this.resolveId(themeId));
  }

  /** Number of registered themes. */
  get size(): number {
    return this.themes.size;
  }

  /** Set the default theme ID. */
  setDefaultTheme(themeId: string): void {
    const resolvedId = this.resolveId(themeId);
    if (!this.themes.has(resolvedId)) {
      console.warn(`Cannot set default to "${themeId}", not registered.`);
      return;
    }
    this.defaultThemeId = resolvedId;
  }

  /** Clear all registered themes. */
  clear(): void {
    this.themes.clear();
  }

  // ---- Tier-based access ----

  /** Check if a theme is available for a given tier. */
  isAvailableForTier(themeId: string, userTier: TierId): boolean {
    const theme = this.get(themeId);
    if (!theme) return false;
    return theme.access.allowedTiers.includes(userTier);
  }

  /** Get all themes available for a tier. */
  getAvailableForTier(
    userTier: TierId,
  ): ThemeDefinition<TLayout, TComponents, TPages>[] {
    return this.getAll().filter((t) =>
      t.access.allowedTiers.includes(userTier),
    );
  }

  /** Get public picker themes for a tier, excluding hidden compatibility rows. */
  getPublicForTier(
    userTier: TierId,
  ): ThemeDefinition<TLayout, TComponents, TPages>[] {
    return this.getAvailableForTier(userTier).filter(
      (theme) => !theme.metadata.isHidden,
    );
  }

  // ---- Category grouping ----

  /** Group themes by their metadata.category (ThemeCategory). */
  getGroupedByCategory(): Record<
    ThemeCategory,
    ThemeDefinition<TLayout, TComponents, TPages>[]
  > {
    const grouped: Record<
      ThemeCategory,
      ThemeDefinition<TLayout, TComponents, TPages>[]
    > = {
      free: [],
      starter: [],
      pro: [],
      agency: [],
    };
    for (const theme of this.getAll()) {
      grouped[theme.metadata.category]?.push(theme);
    }
    return grouped;
  }

  /** Group themes by their palette category (PaletteCategory). */
  getGroupedByPaletteCategory(): Record<
    PaletteCategory,
    ThemeDefinition<TLayout, TComponents, TPages>[]
  > {
    const grouped: Record<
      PaletteCategory,
      ThemeDefinition<TLayout, TComponents, TPages>[]
    > = {
      neutral: [],
      warm: [],
      cool: [],
      vibrant: [],
      pastel: [],
      nature: [],
      corporate: [],
    };
    for (const theme of this.getAll()) {
      if (theme.palette) grouped[theme.palette.category]?.push(theme);
    }
    return grouped;
  }

  // ---- Theme resolution ----

  /**
   * Resolve a theme for rendering.
   *
   * Returns a ResolvedTheme with the effective CSS variables
   * for the requested mode (light or dark).
   */
  resolve(
    themeId: string,
    userTier: TierId,
    isDark: boolean,
  ): ResolvedTheme<TLayout, TComponents, TPages> {
    const theme = this.get(themeId) ?? this.getDefault();
    const isAvailable = this.isAvailableForTier(theme.metadata.id, userTier);
    const effectiveVariables: ThemeColorVariables = isDark
      ? theme.darkVariables
      : theme.lightVariables;

    return {
      ...theme,
      isAvailable,
      isDark,
      effectiveVariables,
    };
  }

  /**
   * Get themes formatted for the palette selector UI.
   *
   * Returns themes grouped by palette category, each annotated
   * with availability and respecting the user's disabled palettes.
   */
  getThemesForSelector(
    userTier: TierId,
    disabledPalettes: string[] = [],
  ): {
    category: PaletteCategory;
    themes: (ThemeDefinition<TLayout, TComponents, TPages> & {
      isAvailable: boolean;
      isEnabled: boolean;
    })[];
  }[] {
    const categories: PaletteCategory[] = [
      'neutral',
      'warm',
      'cool',
      'vibrant',
      'pastel',
      'nature',
      'corporate',
    ];
    const grouped = this.getGroupedByPaletteCategory();
    const disabledSet = new Set(disabledPalettes);

    return categories
      .filter((cat) => grouped[cat].length > 0)
      .map((category) => ({
        category,
        themes: grouped[category]
          .filter((theme) => !theme.metadata.isHidden)
          .map((theme) => ({
            ...theme,
            isAvailable: this.isAvailableForTier(theme.metadata.id, userTier),
            isEnabled: !disabledSet.has(theme.palette?.id ?? theme.metadata.id),
          })),
      }));
  }
}
