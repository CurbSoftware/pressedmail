/**
 * Color scale generator.
 *
 * Generates 13-stop OKLCH color scales from a base color.
 * Used by the Agency-tier custom theme builder.
 * Built-in palette presets use hand-crafted scales instead.
 */
import type { ColorScale, OklchColor } from '../types/colors';
import { formatOklch } from './oklch';

/**
 * Scale stop definitions with target lightness values.
 * These determine the L (lightness) distribution across the scale.
 */
const SCALE_STOPS: Array<{ stop: keyof ColorScale; lightness: number }> = [
  { stop: 25, lightness: 0.985 },
  { stop: 50, lightness: 0.97 },
  { stop: 100, lightness: 0.93 },
  { stop: 200, lightness: 0.87 },
  { stop: 300, lightness: 0.78 },
  { stop: 400, lightness: 0.68 },
  { stop: 500, lightness: 0.58 },
  { stop: 600, lightness: 0.49 },
  { stop: 700, lightness: 0.4 },
  { stop: 800, lightness: 0.32 },
  { stop: 900, lightness: 0.24 },
  { stop: 950, lightness: 0.18 },
  { stop: 1000, lightness: 0.14 },
];

/**
 * Neutral scale stops: lower chroma for grayscale/neutral palettes.
 */
const NEUTRAL_SCALE_STOPS: Array<{
  stop: keyof ColorScale;
  lightness: number;
  chroma: number;
}> = [
  { stop: 25, lightness: 0.99, chroma: 0.002 },
  { stop: 50, lightness: 0.97, chroma: 0.003 },
  { stop: 100, lightness: 0.93, chroma: 0.005 },
  { stop: 200, lightness: 0.87, chroma: 0.007 },
  { stop: 300, lightness: 0.78, chroma: 0.01 },
  { stop: 400, lightness: 0.68, chroma: 0.012 },
  { stop: 500, lightness: 0.55, chroma: 0.015 },
  { stop: 600, lightness: 0.45, chroma: 0.015 },
  { stop: 700, lightness: 0.37, chroma: 0.012 },
  { stop: 800, lightness: 0.28, chroma: 0.01 },
  { stop: 900, lightness: 0.21, chroma: 0.007 },
  { stop: 950, lightness: 0.17, chroma: 0.005 },
  { stop: 1000, lightness: 0.14, chroma: 0.004 },
];

/**
 * Generate a primary (chromatic) color scale from a seed color.
 *
 * The seed is typically the 500-600 stop. The scale is built by
 * varying lightness while preserving hue and adjusting chroma
 * (lighter colors have less chroma, darker colors slightly reduced).
 */
export function generatePrimaryScale(seed: OklchColor): ColorScale {
  const result: Record<number, string> = {};

  for (const { stop, lightness } of SCALE_STOPS) {
    // Chroma curve: peak at mid-lightness, reduced at extremes
    const chromaFactor = 1 - Math.abs(lightness - 0.55) * 1.2;
    const chroma = seed.c * Math.max(0.15, chromaFactor);

    result[stop] = formatOklch({
      l: lightness,
      c: chroma,
      h: seed.h,
    });
  }

  return result as unknown as ColorScale;
}

/**
 * Generate a neutral (low-chroma) color scale with a subtle hue tint.
 * The hue parameter gives the neutral a warm/cool tint.
 */
export function generateNeutralScale(hue: number): ColorScale {
  const result: Record<number, string> = {};

  for (const { stop, lightness, chroma } of NEUTRAL_SCALE_STOPS) {
    result[stop] = formatOklch({
      l: lightness,
      c: chroma,
      h: hue,
    });
  }

  return result as unknown as ColorScale;
}

/**
 * Generate both base and primary scales from a single hue.
 * Convenience function for the palette generator.
 */
export function generateScalesFromHue(
  primaryHue: number,
  primaryChroma: number = 0.2,
  neutralHue?: number,
): { base: ColorScale; primary: ColorScale } {
  return {
    base: generateNeutralScale(neutralHue ?? primaryHue),
    primary: generatePrimaryScale({
      l: 0.55,
      c: primaryChroma,
      h: primaryHue,
    }),
  };
}
