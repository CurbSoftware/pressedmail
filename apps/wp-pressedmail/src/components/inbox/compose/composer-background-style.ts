import type { CSSProperties } from "react";

import {
  normalizeHexColor,
  selectActionForeground,
} from "@/lib/whitelabel/brand-palette";

/**
 * CSS custom properties the composer surfaces read for user-set backgrounds.
 * They are set on the outer surface wrapper and inherited by
 * `.pm-email-content-surface`, `.pm-email-preview-surface`, and the live
 * `[data-slate-editor]` sheet so the colors survive the Preview white-override.
 */
export const COMPOSER_BODY_BG_VAR = "--pm-email-body-bg";
export const COMPOSER_CANVAS_BG_VAR = "--pm-email-canvas-bg";
export const COMPOSER_FONT_SIZE_VAR = "--pm-composer-font-size";
export const COMPOSER_FONT_FAMILY_VAR = "--pm-composer-font-family";

export interface ComposerSurfaceColors {
  /** Email "sheet" background, also serialized into the sent email. */
  bodyBackgroundColor?: string;
  /** Canvas pane around the email, composer-only, never sent. */
  canvasBackgroundColor?: string;
  /**
   * Default writing/editing font size (px) for the email body. Published as an
   * inherited CSS variable that the live `[data-slate-editor]` surface reads;
   * the stylesheet falls back to 14px when this is omitted.
   */
  fontSizePx?: number;
  /** Default writing font family, published as an inherited CSS variable. */
  fontFamily?: string;
}

/**
 * Build the inline style that publishes the user's chosen background colors and
 * default writing font size as inherited CSS variables on the composer surface
 * wrapper. Undefined/zero values are omitted so the stylesheet fallbacks (theme
 * card / white / 14px) apply.
 */
export function buildComposerSurfaceStyle({
  bodyBackgroundColor,
  canvasBackgroundColor,
  fontSizePx,
  fontFamily,
}: ComposerSurfaceColors): CSSProperties | undefined {
  const style: Record<string, string> = {};

  if (bodyBackgroundColor) {
    style[COMPOSER_BODY_BG_VAR] = bodyBackgroundColor;
  }
  if (canvasBackgroundColor) {
    style[COMPOSER_CANVAS_BG_VAR] = canvasBackgroundColor;
  }
  if (fontSizePx) {
    style[COMPOSER_FONT_SIZE_VAR] = `${fontSizePx}px`;
  }
  if (fontFamily) {
    style[COMPOSER_FONT_FAMILY_VAR] = fontFamily;
  }

  return Object.keys(style).length > 0
    ? (style as CSSProperties)
    : undefined;
}

/**
 * Text colour that reads on a picked body background. The authoring canvas
 * follows the UI theme, so a white body in dark mode would otherwise carry
 * near-white text. Undefined when there is no pick or it is not a hex colour.
 */
export function readableBodyForeground(
  bodyBackgroundColor?: string,
): string | undefined {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(
    bodyBackgroundColor?.trim() ?? "",
  );
  const hex = normalizeHexColor(
    short
      ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
      : (bodyBackgroundColor ?? ""),
  );
  return hex ? selectActionForeground(hex, "#FFFFFF") : undefined;
}
