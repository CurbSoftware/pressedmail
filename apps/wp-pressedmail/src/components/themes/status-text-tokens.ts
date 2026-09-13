/**
 * Text-safe variants of the status and primary colours, and the CSS that points
 * the text utilities at them.
 *
 * `--success`, `--warning`, `--info`, `--destructive` and `--primary` are fill
 * colours: they are picked to carry white foreground text, so using one AS text
 * on a card lands between 2.9:1 and 4.1:1. The text variants keep the hue and
 * the chroma and move only the lightness, which is the one thing OKLCH makes
 * safe to do.
 *
 * Both editions need this. Pro builds the values from each palette's hues in
 * theme-variables.ts. The Free edition has no palette registry (its two themes
 * are plain CSS and its provider only sets a class), so ThemeProvider.free.tsx
 * reads the applied fill and derives the text variant with the helpers here.
 * One definition, the same numbers in both bundles, and nothing in this module
 * imports THEME_REGISTRY, so the Free bundle does not pull the Pro palettes in.
 */

/**
 * Lightness for text on a light surface, and on a dark one.
 *
 * 0.44 keeps every hue in use at or above 4.5:1 on white and on the /10 and /20
 * tints these colours are usually set on; 0.8 does the same on the dark card.
 */
export const LIGHT_STATUS_TEXT_LIGHTNESS = 0.44;
export const DARK_STATUS_TEXT_LIGHTNESS = 0.8;

/** Each text token and the fill token it is derived from. */
export const STATUS_TEXT_TOKEN_SOURCES = {
  "--primary-text": "--primary",
  "--success-text": "--success",
  "--warning-text": "--warning",
  "--info-text": "--info",
  "--destructive-text": "--destructive",
} as const;

/** Rewrite an OKLCH colour's lightness, leaving chroma, hue and alpha alone. */
export function withOklchLightness(color: string, lightness: number): string {
  const match =
    /^oklch\(\s*[0-9.]+\s+([0-9.]+)\s+([0-9.]+)(\s*\/\s*[^)]+)?\s*\)$/.exec(
      color.trim(),
    );

  if (!match) {
    return color;
  }

  return `oklch(${lightness} ${match[1]} ${match[2]}${match[3] ?? ""})`;
}

/**
 * The elements a theme applies to: the admin app, the front-end app, and the
 * portals Radix renders outside both.
 */
export const THEME_SCOPE_SELECTORS = [
  "#pressedmail-plugin",
  "#pressedmail-plugin-frontend",
  "[data-pm-portal]",
  "[data-radix-portal]",
] as const;

/** Semantic color classes that opt out of the default anchor color. */
const TEXT_COLOR_UTILITIES = [
  "text-foreground",
  "text-muted-foreground",
  "text-primary",
  "text-success",
  "text-warning",
  "text-info",
  "text-destructive",
];

/** Link defaults stay weaker than theme-specific anchor rules. */
export function themeAnchorResetCss(): string {
  const colorUtilities = [
    ...TEXT_COLOR_UTILITIES,
    "text-primary-foreground",
    "text-secondary-foreground",
    "text-accent-foreground",
    "text-card-foreground",
    "text-popover-foreground",
    "text-destructive-foreground",
    "text-success-foreground",
    "text-warning-foreground",
    "text-info-foreground",
    "text-white",
    "text-black",
    "text-current",
    "text-inherit",
    "text-transparent",
  ];
  const withoutColor = colorUtilities
    .map((utility) => `:not(.${utility})`)
    .join("");
  const scope = `:where(${THEME_SCOPE_SELECTORS.join(", ")})`;

  // :where contributes no specificity. This beats wp-admin's bare anchor rule
  // by source order while preserving a theme's own link colors and hover state.
  return `${scope} a:where([href]:not([data-slot="button"]):not([role="button"])${withoutColor}) {
  color: var(--primary-text, var(--primary));
}
${scope} .signature-preview a:where([href]) {
  text-decoration: underline;
  text-underline-offset: 0.15em;
}`;
}

/**
 * Text utilities and all their variants are promoted by styles/text-color-cascade.cjs
 * from Tailwind's compiled CSS. Runtime base-class overrides would mask them.
 */
export function themeTextUtilityCss(): string {
  return themeAnchorResetCss();
}
