import type { ThemeColorVariables } from "@/types/theme";
import {
  RADIUS_PRESETS,
  type GuidedBrandPalette,
  type HexColor,
  type RadiusPreset,
} from "../../types/whitelabel";

const DARK_ACTION_FOREGROUND = "#0B0F14" as const;
const LIGHT_ACTION_FOREGROUND = "#F8FAFC" as const;
const MINIMUM_CONTRAST = 4.5;

export const RADIUS_VALUES: Record<RadiusPreset, string> = {
  subtle: "0.375rem",
  standard: "0.625rem",
  rounded: "1rem",
};

interface OklchColor {
  l: number;
  c: number;
  h: number;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface RgbaColor extends RgbColor {
  a: number;
}

type Triplet = readonly [number, number, number];

export type BrandPaletteErrors = Partial<
  Record<keyof GuidedBrandPalette, string>
>;

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeHue(hue: number): number {
  const normalized = hue % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/**
 * Canonical palette form: `#RRGGBB` when opaque, `#RRGGBBAA` when translucent.
 *
 * Opaque colors keep the six-digit form so an existing saved palette is never
 * rewritten into a longer string just because alpha became available.
 */
export function normalizeHexColor(value: string): HexColor | null {
  const normalized = value.trim().toUpperCase();
  return /^#([0-9A-F]{6}|[0-9A-F]{8})$/.test(normalized)
    ? (normalized as HexColor)
    : null;
}

function hexToRgba(value: string): RgbaColor | null {
  const hex = normalizeHexColor(value);
  if (!hex) return null;

  return {
    r: Number.parseInt(hex.slice(1, 3), 16) / 255,
    g: Number.parseInt(hex.slice(3, 5), 16) / 255,
    b: Number.parseInt(hex.slice(5, 7), 16) / 255,
    a: hex.length === 9 ? Number.parseInt(hex.slice(7, 9), 16) / 255 : 1,
  };
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
  return channel <= 0.0031308
    ? 12.92 * channel
    : 1.055 * channel ** (1 / 2.4) - 0.055;
}

function multiplyMatrix(matrix: readonly Triplet[], values: Triplet): Triplet {
  return matrix.map(
    (row) => row[0] * values[0] + row[1] * values[1] + row[2] * values[2],
  ) as unknown as Triplet;
}

function rgbToOklch(rgb: RgbColor): OklchColor {
  const linearRgb: Triplet = [
    srgbToLinear(rgb.r),
    srgbToLinear(rgb.g),
    srgbToLinear(rgb.b),
  ];
  const xyz = multiplyMatrix(
    [
      [506752 / 1228815, 87881 / 245763, 12673 / 70218],
      [87098 / 409605, 175762 / 245763, 12673 / 175545],
      [7918 / 409605, 87881 / 737289, 1001167 / 1053270],
    ],
    linearRgb,
  );
  const lms = multiplyMatrix(
    [
      [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
      [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
      [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
    ],
    xyz,
  ).map(Math.cbrt) as unknown as Triplet;
  const [lightness, a, yellowBlue] = multiplyMatrix(
    [
      [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
      [1.9779985324311684, -2.42859224204858, 0.450593709617411],
      [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
    ],
    lms,
  );
  const chroma = Math.sqrt(a * a + yellowBlue * yellowBlue);

  return {
    l: lightness,
    c: chroma,
    h: chroma < 0.000001
      ? 0
      : normalizeHue((Math.atan2(yellowBlue, a) * 180) / Math.PI),
  };
}

function oklchToLinearRgb(color: OklchColor): RgbColor {
  const hue = (color.h * Math.PI) / 180;
  const a = color.c * Math.cos(hue);
  const yellowBlue = color.c * Math.sin(hue);

  const lmsRoot = multiplyMatrix(
    [
      [1, 0.3963377773761749, 0.2158037573099136],
      [1, -0.1055613458156586, -0.0638541728258133],
      [1, -0.0894841775298119, -1.2914855480194092],
    ],
    [color.l, a, yellowBlue],
  );
  const lms = lmsRoot.map((value) => value ** 3) as unknown as Triplet;
  const xyz = multiplyMatrix(
    [
      [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
      [-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
      [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
    ],
    lms,
  );
  const [r, g, b] = multiplyMatrix(
    [
      [12831 / 3959, -329 / 214, -1974 / 3959],
      [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
      [705 / 12673, -2585 / 12673, 705 / 667],
    ],
    xyz,
  );

  return { r, g, b };
}

function isInSrgbGamut(rgb: RgbColor): boolean {
  const epsilon = 0.0000001;
  return Object.values(rgb).every(
    (channel) => channel >= -epsilon && channel <= 1 + epsilon,
  );
}

function gamutMap(color: OklchColor): { color: OklchColor; rgb: RgbColor } {
  let candidate = { ...color, h: normalizeHue(color.h) };
  let rgb = oklchToLinearRgb(candidate);

  for (let iteration = 0; iteration < 40 && !isInSrgbGamut(rgb); iteration += 1) {
    candidate = { ...candidate, c: Math.max(0, candidate.c - 0.005) };
    rgb = oklchToLinearRgb(candidate);
  }

  return {
    color: candidate,
    rgb: {
      r: clamp(rgb.r),
      g: clamp(rgb.g),
      b: clamp(rgb.b),
    },
  };
}

function linearRgbToHex(rgb: RgbColor): HexColor {
  const channel = (value: number): string =>
    Math.round(clamp(linearToSrgb(clamp(value))) * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();

  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}` as HexColor;
}

/** Encode already sRGB-encoded channels, with no transfer function applied. */
function encodedRgbToHex(rgb: RgbColor): HexColor {
  const channel = (value: number): string =>
    Math.round(clamp(value) * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();

  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}` as HexColor;
}

function formatAlphaByte(alpha: number): string {
  return Math.round(clamp(alpha) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

/** Reattach transparency to an opaque color, keeping six digits when opaque. */
function withAlpha(hex: HexColor, alpha: number): HexColor {
  return alpha >= 1
    ? hex
    : (`${hex}${formatAlphaByte(alpha)}` as HexColor);
}

/**
 * Simple source-over compositing in the sRGB channel space, which is the space
 * the rest of this module's color maths consumes.
 *
 * Alpha has to be resolved somewhere before contrast means anything: 50% black
 * on white is a mid grey (3.95:1), not black (21:1). The palette gate composites
 * so it measures the color a person actually sees. An opaque top color is
 * returned untouched, so the opaque path is byte-identical to no compositing.
 */
export function compositeOver(top: string, bottom: string): HexColor {
  const source = hexToRgba(top);
  const backdrop = hexToRgba(bottom);
  if (!source) throw new TypeError(`Invalid hex color: ${top}`);
  if (!backdrop) throw new TypeError(`Invalid hex color: ${bottom}`);

  if (source.a >= 1) return normalizeHexColor(top) as HexColor;

  const mix = (front: number, back: number): number =>
    front * source.a + back * (1 - source.a);

  return encodedRgbToHex({
    r: mix(source.r, backdrop.r),
    g: mix(source.g, backdrop.g),
    b: mix(source.b, backdrop.b),
  });
}

function hexToOklch(value: string): OklchColor {
  const rgba = hexToRgba(value);
  if (!rgba) {
    throw new TypeError(`Invalid hex color: ${value}`);
  }

  return rgbToOklch(rgba);
}

function oklchToHex(color: OklchColor): HexColor {
  return linearRgbToHex(gamutMap(color).rgb);
}

/**
 * Read an `oklch(L C H)` token, as `theme-variables.ts` writes them. Anything
 * else (`transparent`, a `color-mix()`, a percentage form) returns null so a
 * caller can skip it rather than throw on a token it never promised to handle.
 */
function parseOklchToken(value: unknown): OklchColor | null {
  if (typeof value !== "string") return null;

  const match = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(
    value.trim(),
  );
  if (!match) return null;

  const [, lightness, chroma, hue] = match;
  return {
    l: Number(lightness),
    c: Number(chroma),
    h: Number(hue),
  };
}

const GUIDED_TOKEN_KEYS = {
  primary: "--primary",
  secondary: "--secondary",
  accent: "--accent",
  background: "--background",
  foreground: "--foreground",
} as const;

/**
 * Seed the guided colors from a base theme's own tokens, so selecting a base
 * theme shows the colors that theme actually paints with. Tokens that do not
 * parse are omitted, and the caller keeps whatever it had for that field.
 */
export function paletteColorsFromTokens(
  tokens: ThemeColorVariables,
): Partial<
  Pick<
    GuidedBrandPalette,
    "primary" | "secondary" | "accent" | "background" | "foreground"
  >
> {
  const colors: Record<string, HexColor> = {};

  for (const [field, token] of Object.entries(GUIDED_TOKEN_KEYS)) {
    const parsed = parseOklchToken(tokens[token]);
    if (parsed) {
      colors[field] = oklchToHex(parsed);
    }
  }

  return colors as Partial<
    Pick<
      GuidedBrandPalette,
      "primary" | "secondary" | "accent" | "background" | "foreground"
    >
  >;
}

function formatOklch(value: string): string {
  const rgba = hexToRgba(value);
  if (!rgba) {
    throw new TypeError(`Invalid hex color: ${value}`);
  }

  const color = rgbToOklch(rgba);
  const base = `oklch(${color.l.toFixed(4)} ${color.c.toFixed(4)} ${normalizeHue(color.h).toFixed(2)}`;

  return rgba.a >= 1 ? `${base})` : `${base} / ${rgba.a.toFixed(3)})`;
}

/**
 * WCAG relative luminance of a color as it appears over `backdrop`.
 */
function relativeLuminance(value: string, backdrop: string): number {
  const rgba = hexToRgba(value);
  if (!rgba) {
    throw new TypeError(`Invalid hex color: ${value}`);
  }

  const visible =
    rgba.a >= 1 ? rgba : (hexToRgba(compositeOver(value, backdrop)) as RgbaColor);

  return (
    0.2126 * srgbToLinear(visible.r) +
    0.7152 * srgbToLinear(visible.g) +
    0.0722 * srgbToLinear(visible.b)
  );
}

/**
 * Contrast of `onTop` as it is painted over `underneath`.
 *
 * `underneath` is the backdrop rather than a subject, so it has to be opaque:
 * a translucent backdrop has no measurable luminance until something else is
 * named behind it, and inventing that here would hide the ambiguity.
 */
export function contrastRatio(onTop: string, underneath: string): number {
  const backdrop = hexToRgba(underneath);
  if (!backdrop) throw new TypeError(`Invalid hex color: ${underneath}`);
  if (backdrop.a < 1) {
    throw new TypeError("A contrast backdrop must be opaque.");
  }

  const firstLuminance = relativeLuminance(onTop, underneath);
  const secondLuminance = relativeLuminance(underneath, underneath);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Choose the fixed foreground a translucent or opaque action color can carry.
 *
 * The action is composited over `surface` first, because the foreground is
 * chosen against what the action looks like once painted, not against its raw
 * channels.
 */
export function selectActionForeground(
  actionColor: string,
  surface: string,
): HexColor {
  const action = compositeOver(actionColor, surface);
  const darkContrast = contrastRatio(action, DARK_ACTION_FOREGROUND);
  const lightContrast = contrastRatio(action, LIGHT_ACTION_FOREGROUND);
  return darkContrast >= lightContrast
    ? DARK_ACTION_FOREGROUND
    : LIGHT_ACTION_FOREGROUND;
}

export function validateBrandPalette(
  palette: GuidedBrandPalette,
): BrandPaletteErrors {
  const errors: BrandPaletteErrors = {};
  const colorFields = [
    "primary",
    "secondary",
    "accent",
    "background",
    "foreground",
  ] as const;

  for (const field of colorFields) {
    const normalized = normalizeHexColor(palette[field]);
    if (!normalized) {
      errors[field] =
        "Use a six-digit hexadecimal color, or eight digits to add transparency.";
      continue;
    }

    if (field === "background" && normalized.length === 9) {
      errors[field] = "The background must be an opaque six-digit color.";
    }
  }

  if (!RADIUS_PRESETS.includes(palette.radius)) {
    errors.radius = "Choose a supported radius preset.";
  }

  if (!errors.background && !errors.foreground) {
    if (contrastRatio(palette.foreground, palette.background) < MINIMUM_CONTRAST) {
      errors.foreground = "Foreground and background must meet WCAG AA contrast.";
    }
  }

  for (const field of ["primary", "secondary", "accent"] as const) {
    // The action gate needs an opaque backdrop to composite over, so it stands
    // down when the background itself is the field at fault.
    if (errors[field] || errors.background) continue;
    const surface = palette.background;
    const foreground = selectActionForeground(palette[field], surface);
    if (
      contrastRatio(compositeOver(palette[field], surface), foreground) <
      MINIMUM_CONTRAST
    ) {
      errors[field] = "Action color must support an accessible foreground.";
    }
  }

  return errors;
}

export function createDarkPalette(
  lightPalette: GuidedBrandPalette,
): GuidedBrandPalette {
  const transformSurface = (
    value: string,
    lightness: number,
    maximumChroma: number,
  ): HexColor => {
    const source = hexToOklch(value);
    return withAlpha(
      oklchToHex({
        l: lightness,
        c: Math.min(source.c, maximumChroma),
        h: source.c < 0.005 ? 0 : source.h,
      }),
      hexToRgba(value)?.a ?? 1,
    );
  };
  const transformAction = (value: string): HexColor => {
    const source = hexToOklch(value);
    return withAlpha(
      oklchToHex({
        l: clamp(0.62 + (source.l - 0.5) * 0.2, 0.58, 0.72),
        c: Math.min(source.c, 0.18),
        h: source.c < 0.005 ? 0 : source.h,
      }),
      hexToRgba(value)?.a ?? 1,
    );
  };

  // Transparency is a property of the authored color, not of its lightness, so
  // the dark half keeps whatever the light half was given.
  return {
    primary: transformAction(lightPalette.primary),
    secondary: transformAction(lightPalette.secondary),
    accent: transformAction(lightPalette.accent),
    background: transformSurface(lightPalette.background, 0.16, 0.025),
    foreground: transformSurface(lightPalette.foreground, 0.96, 0.02),
    radius: lightPalette.radius,
  };
}

export function compileBrandTheme(
  baseTheme: ThemeColorVariables,
  palette: GuidedBrandPalette,
): ThemeColorVariables {
  const errors = validateBrandPalette(palette);
  if (Object.keys(errors).length > 0) {
    throw new TypeError("Cannot compile an invalid brand palette.");
  }

  const background = formatOklch(palette.background);
  const foreground = formatOklch(palette.foreground);
  const primary = formatOklch(palette.primary);
  const primaryForeground = formatOklch(
    selectActionForeground(palette.primary, palette.background),
  );
  const secondary = formatOklch(palette.secondary);
  const secondaryForeground = formatOklch(
    selectActionForeground(palette.secondary, palette.background),
  );
  const accent = formatOklch(palette.accent);
  const accentForeground = formatOklch(
    selectActionForeground(palette.accent, palette.background),
  );

  return {
    ...baseTheme,
    "--background": background,
    "--card": background,
    "--popover": background,
    "--sidebar-background": background,
    "--foreground": foreground,
    "--card-foreground": foreground,
    "--popover-foreground": foreground,
    "--sidebar-foreground": foreground,
    "--primary": primary,
    "--primary-foreground": primaryForeground,
    "--secondary": secondary,
    "--secondary-foreground": secondaryForeground,
    "--accent": accent,
    "--accent-foreground": accentForeground,
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": primaryForeground,
    "--sidebar-accent": accent,
    "--sidebar-accent-foreground": accentForeground,
    "--ring": primary,
    "--checkbox-checked-background": primary,
    "--checkbox-checked-foreground": primaryForeground,
    "--radius": RADIUS_VALUES[palette.radius],
  };
}
