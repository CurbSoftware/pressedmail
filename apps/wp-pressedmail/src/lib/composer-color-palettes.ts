/**
 * Composer Color Palette: locked 12×11 default grid plus shared caps.
 *
 * The composer text-color / highlight / background popovers share a single
 * Tailwind-shade palette. Defaults are locked: only the user-managed
 * `palette_custom_colors` and `palette_recent_colors` are stored in user
 * meta and may be edited at runtime.
 */

export const COMPOSER_PALETTE_HUES = [
  "red",
  "orange",
  "amber",
  "yellow",
  "green",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "purple",
  "pink",
] as const;

export type ComposerPaletteHue = (typeof COMPOSER_PALETTE_HUES)[number];

export const COMPOSER_PALETTE_SHADES = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950",
] as const;

export type ComposerPaletteShade = (typeof COMPOSER_PALETTE_SHADES)[number];

export const COMPOSER_NEUTRAL_COLORS = [
  "#ffffff",
  "#e6e6e6",
  "#cccccc",
  "#b3b3b3",
  "#999999",
  "#808080",
  "#666666",
  "#4d4d4d",
  "#333333",
  "#1a1a1a",
  "#000000",
] as const;

/**
 * The single locked palette. Indexed `[hue][shade]`. Source-of-truth
 * for every toolbar popover and the settings-page preview.
 */
export const COMPOSER_PALETTE_DEFAULT: Record<
  ComposerPaletteHue,
  Record<ComposerPaletteShade, string>
> = {
  red: {
    "50": "#fef2f2",
    "100": "#fee2e2",
    "200": "#fecaca",
    "300": "#fca5a5",
    "400": "#f87171",
    "500": "#ef4444",
    "600": "#dc2626",
    "700": "#b91c1c",
    "800": "#991b1b",
    "900": "#7f1d1d",
    "950": "#450a0a",
  },
  orange: {
    "50": "#fff7ed",
    "100": "#ffedd5",
    "200": "#fed7aa",
    "300": "#fdba74",
    "400": "#fb923c",
    "500": "#f97316",
    "600": "#ea580c",
    "700": "#c2410c",
    "800": "#9a3412",
    "900": "#7c2d12",
    "950": "#431407",
  },
  amber: {
    "50": "#fffbeb",
    "100": "#fef3c7",
    "200": "#fde68a",
    "300": "#fcd34d",
    "400": "#fbbf24",
    "500": "#f59e0b",
    "600": "#d97706",
    "700": "#b45309",
    "800": "#92400e",
    "900": "#78350f",
    "950": "#451a03",
  },
  yellow: {
    "50": "#fefce8",
    "100": "#fef9c3",
    "200": "#fef08a",
    "300": "#fde047",
    "400": "#facc15",
    "500": "#eab308",
    "600": "#ca8a04",
    "700": "#a16207",
    "800": "#854d0e",
    "900": "#713f12",
    "950": "#422006",
  },
  green: {
    "50": "#f0fdf4",
    "100": "#dcfce7",
    "200": "#bbf7d0",
    "300": "#86efac",
    "400": "#4ade80",
    "500": "#22c55e",
    "600": "#16a34a",
    "700": "#15803d",
    "800": "#166534",
    "900": "#14532d",
    "950": "#052e16",
  },
  teal: {
    "50": "#f0fdfa",
    "100": "#ccfbf1",
    "200": "#99f6e4",
    "300": "#5eead4",
    "400": "#2dd4bf",
    "500": "#14b8a6",
    "600": "#0d9488",
    "700": "#0f766e",
    "800": "#115e59",
    "900": "#134e4a",
    "950": "#042f2e",
  },
  cyan: {
    "50": "#ecfeff",
    "100": "#cffafe",
    "200": "#a5f3fc",
    "300": "#67e8f9",
    "400": "#22d3ee",
    "500": "#06b6d4",
    "600": "#0891b2",
    "700": "#0e7490",
    "800": "#155e75",
    "900": "#164e63",
    "950": "#083344",
  },
  sky: {
    "50": "#f0f9ff",
    "100": "#e0f2fe",
    "200": "#bae6fd",
    "300": "#7dd3fc",
    "400": "#38bdf8",
    "500": "#0ea5e9",
    "600": "#0284c7",
    "700": "#0369a1",
    "800": "#075985",
    "900": "#0c4a6e",
    "950": "#082f49",
  },
  blue: {
    "50": "#eff6ff",
    "100": "#dbeafe",
    "200": "#bfdbfe",
    "300": "#93c5fd",
    "400": "#60a5fa",
    "500": "#3b82f6",
    "600": "#2563eb",
    "700": "#1d4ed8",
    "800": "#1e40af",
    "900": "#1e3a8a",
    "950": "#172554",
  },
  indigo: {
    "50": "#eef2ff",
    "100": "#e0e7ff",
    "200": "#c7d2fe",
    "300": "#a5b4fc",
    "400": "#818cf8",
    "500": "#6366f1",
    "600": "#4f46e5",
    "700": "#4338ca",
    "800": "#3730a3",
    "900": "#312e81",
    "950": "#1e1b4b",
  },
  purple: {
    "50": "#faf5ff",
    "100": "#f3e8ff",
    "200": "#e9d5ff",
    "300": "#d8b4fe",
    "400": "#c084fc",
    "500": "#a855f7",
    "600": "#9333ea",
    "700": "#7e22ce",
    "800": "#6b21a8",
    "900": "#581c87",
    "950": "#3b0764",
  },
  pink: {
    "50": "#fdf2f8",
    "100": "#fce7f3",
    "200": "#fbcfe8",
    "300": "#f9a8d4",
    "400": "#f472b6",
    "500": "#ec4899",
    "600": "#db2777",
    "700": "#be185d",
    "800": "#9d174d",
    "900": "#831843",
    "950": "#500724",
  },
};

export const COMPOSER_CUSTOM_COLOR_COLUMNS = 2;
export const COMPOSER_CUSTOM_COLOR_MAX =
  COMPOSER_PALETTE_SHADES.length * COMPOSER_CUSTOM_COLOR_COLUMNS; // 22
export const COMPOSER_RECENT_COLOR_MAX = 8;

/**
 * Selectable palette density. Lets users show a smaller swatch grid in the
 * composer color popovers instead of the full 12×11 wall every time.
 * - `full`    : all 12 hues × 11 shades (default; unchanged behavior)
 * - `reduced` : same 12 hues, fewer shades
 * - `minimal` : fewer hues AND fewer shades
 */
export type ComposerPaletteLevel = "full" | "reduced" | "minimal";


const REDUCED_SHADES: ComposerPaletteShade[] = [
  "50",
  "100",
  "300",
  "500",
  "700",
  "900",
  "950",
];
/**
 * Grayscale ramps per density level, kept to the SAME swatch count as that
 * level's shade grid (Full 11 / Reduced 7 / Minimal 3). White + black anchor
 * every ramp; the intermediate grays are evenly spaced picks from the full
 * neutral ramp.
 */
const REDUCED_NEUTRAL = [
  "#ffffff",
  "#cccccc",
  "#999999",
  "#808080",
  "#666666",
  "#333333",
  "#000000",
] as const;
const MINIMAL_NEUTRAL = ["#ffffff", "#808080", "#000000"] as const;
const MINIMAL_HUES: ComposerPaletteHue[] = [
  "red",
  "amber",
  "green",
  "blue",
  "purple",
  "pink",
];
const MINIMAL_SHADES: ComposerPaletteShade[] = ["300", "500", "700"];

/**
 * Resolve the active hue/shade sets for a density level. Unknown/undefined
 * falls back to the full grid so the composer never renders an empty palette.
 */
export function getActivePalette(level: ComposerPaletteLevel | undefined): {
  hues: ComposerPaletteHue[];
  shades: ComposerPaletteShade[];
} {
  switch (level) {
    case "reduced":
      return { hues: [...COMPOSER_PALETTE_HUES], shades: [...REDUCED_SHADES] };
    case "minimal":
      return { hues: [...MINIMAL_HUES], shades: [...MINIMAL_SHADES] };
    case "full":
    default:
      return {
        hues: [...COMPOSER_PALETTE_HUES],
        shades: [...COMPOSER_PALETTE_SHADES],
      };
  }
}

/**
 * Resolve the grayscale (neutral) ramp for a density level so the grayscale
 * column always matches that level's vertical swatch count.
 */
export function getActiveNeutral(
  level: ComposerPaletteLevel | undefined,
): readonly string[] {
  switch (level) {
    case "reduced":
      return REDUCED_NEUTRAL;
    case "minimal":
      return MINIMAL_NEUTRAL;
    case "full":
    default:
      return COMPOSER_NEUTRAL_COLORS;
  }
}

/** Flat list of every locked default hex, lowercased. Useful for membership checks. */
export const COMPOSER_PALETTE_DEFAULT_FLAT: ReadonlyArray<string> = [
  ...COMPOSER_PALETTE_HUES.flatMap((hue) =>
    COMPOSER_PALETTE_SHADES.map((shade) =>
      COMPOSER_PALETTE_DEFAULT[hue][shade].toLowerCase(),
    ),
  ),
  ...COMPOSER_NEUTRAL_COLORS,
];
