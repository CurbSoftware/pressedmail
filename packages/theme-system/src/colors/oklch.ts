/**
 * OKLCH color utilities.
 *
 * Parse, convert, and manipulate colors in the OKLCH color space.
 * OKLCH is perceptually uniform. adjusting L, C, or H feels consistent.
 */
import type { OklchColor } from '../types/colors';

/**
 * Parse an oklch() CSS string into components.
 * Handles formats: "oklch(0.585 0.233 264.052)" and "oklch(0.585 0.233 264.052 / 50%)"
 */
export function parseOklch(value: string): OklchColor | null {
  const match = value.match(
    /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*[\d.]+%?)?\s*\)/,
  );
  if (!match?.[1] || !match[2] || !match[3]) return null;
  return {
    l: parseFloat(match[1]),
    c: parseFloat(match[2]),
    h: parseFloat(match[3]),
  };
}

/**
 * Format an OklchColor to a CSS oklch() string.
 */
export function formatOklch(color: OklchColor): string {
  return `oklch(${round(color.l, 4)} ${round(color.c, 4)} ${round(color.h, 3)})`;
}

/**
 * Adjust lightness of an OKLCH color string.
 * Returns a new oklch() CSS string.
 */
export function adjustLightness(value: string, delta: number): string {
  const color = parseOklch(value);
  if (!color) return value;
  return formatOklch({
    ...color,
    l: clamp(color.l + delta, 0, 1),
  });
}

/**
 * Adjust chroma of an OKLCH color string.
 */
export function adjustChroma(value: string, delta: number): string {
  const color = parseOklch(value);
  if (!color) return value;
  return formatOklch({
    ...color,
    c: clamp(color.c + delta, 0, 0.4),
  });
}

/**
 * Generate a CSS color-mix() expression for opacity blending.
 */
export function withOpacity(value: string, percent: number): string {
  return `color-mix(in oklch, ${value} ${percent}%, transparent)`;
}

/**
 * Linearly interpolate between two OKLCH colors.
 */
export function lerpOklch(a: OklchColor, b: OklchColor, t: number): OklchColor {
  return {
    l: lerp(a.l, b.l, t),
    c: lerp(a.c, b.c, t),
    h: lerpHue(a.h, b.h, t),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate hue on the shortest arc.
 */
function lerpHue(a: number, b: number, t: number): number {
  let diff = b - a;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return (((a + diff * t) % 360) + 360) % 360;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
