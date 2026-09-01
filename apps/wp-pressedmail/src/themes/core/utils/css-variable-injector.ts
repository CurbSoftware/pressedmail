/**
 * CSS Variable Injector
 *
 * Utility for injecting theme colors as CSS custom properties.
 */

import type { ThemeColors } from "../interfaces/colors.interface";

/**
 * CSS variable prefix for theme colors
 */
const CSS_VAR_PREFIX = "--theme";

/**
 * Mapping from ThemeColors keys to CSS variable names
 */
const COLOR_TO_CSS_VAR: Record<keyof ThemeColors, string> = {
  primary: "primary",
  primaryForeground: "primary-foreground",
  primaryHover: "primary-hover",
  primaryActive: "primary-active",
  secondary: "secondary",
  secondaryForeground: "secondary-foreground",
  secondaryHover: "secondary-hover",
  accent: "accent",
  accentForeground: "accent-foreground",
  background: "background",
  foreground: "foreground",
  card: "card",
  cardForeground: "card-foreground",
  popover: "popover",
  popoverForeground: "popover-foreground",
  muted: "muted",
  mutedForeground: "muted-foreground",
  border: "border",
  input: "input",
  ring: "ring",
  success: "success",
  successForeground: "success-foreground",
  warning: "warning",
  warningForeground: "warning-foreground",
  error: "error",
  errorForeground: "error-foreground",
  info: "info",
  infoForeground: "info-foreground",
  unread: "unread",
  starred: "starred",
  important: "important",
  selected: "selected",
  hover: "hover",
};

/**
 * Inject theme colors as CSS custom properties on the document root
 */
export function injectThemeColors(colors: ThemeColors): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  for (const [key, value] of Object.entries(colors)) {
    const cssVarName = COLOR_TO_CSS_VAR[key as keyof ThemeColors];
    if (cssVarName && value) {
      root.style.setProperty(`${CSS_VAR_PREFIX}-${cssVarName}`, value);
    }
  }
}

/**
 * Remove theme color CSS custom properties from the document root
 */
export function removeThemeColors(): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  for (const cssVarName of Object.values(COLOR_TO_CSS_VAR)) {
    root.style.removeProperty(`${CSS_VAR_PREFIX}-${cssVarName}`);
  }
}

/**
 * Inject custom theme CSS variables (for Agency tier custom themes)
 */
export function injectCustomThemeColors(colors: {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  foreground?: string;
  muted?: string;
  card?: string;
  border?: string;
}): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Use --pm prefix for custom theme overrides
  if (colors.primary) root.style.setProperty("--pm-primary", colors.primary);
  if (colors.secondary)
    root.style.setProperty("--pm-secondary", colors.secondary);
  if (colors.accent) root.style.setProperty("--pm-accent", colors.accent);
  if (colors.background)
    root.style.setProperty("--pm-background", colors.background);
  if (colors.foreground)
    root.style.setProperty("--pm-foreground", colors.foreground);
  if (colors.muted) root.style.setProperty("--pm-muted", colors.muted);
  if (colors.card) root.style.setProperty("--pm-card", colors.card);
  if (colors.border) root.style.setProperty("--pm-border", colors.border);
}

/**
 * Remove custom theme CSS variables
 */
export function removeCustomThemeColors(): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  root.style.removeProperty("--pm-primary");
  root.style.removeProperty("--pm-secondary");
  root.style.removeProperty("--pm-accent");
  root.style.removeProperty("--pm-background");
  root.style.removeProperty("--pm-foreground");
  root.style.removeProperty("--pm-muted");
  root.style.removeProperty("--pm-card");
  root.style.removeProperty("--pm-border");
}

/**
 * Apply theme class to body element
 */
export function applyThemeClass(themeId: string, allThemeIds: string[]): void {
  if (typeof document === "undefined") return;

  const body = document.body;

  // Remove all existing theme classes
  for (const id of allThemeIds) {
    body.classList.remove(`${id}-theme`);
  }
  body.classList.remove("custom-theme");

  // Apply new theme class
  if (themeId === "custom") {
    body.classList.add("custom-theme");
  } else {
    body.classList.add(`${themeId}-theme`);
  }
}

/**
 * Inject custom CSS string into document
 */
export function injectCustomCss(css: string, styleId: string): () => void {
  if (typeof document === "undefined") return () => {};

  let styleElement = document.getElementById(
    styleId,
  ) as HTMLStyleElement | null;

  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = css;

  // Return cleanup function
  return () => {
    styleElement?.remove();
  };
}

/**
 * Apply font family to document
 */
export function applyFontFamily(fontFamily: string): void {
  if (typeof document === "undefined") return;

  document.documentElement.style.setProperty("--pm-font-family", fontFamily);
}

/**
 * Apply font size to document
 */
export function applyFontSize(fontSize: string): void {
  if (typeof document === "undefined") return;

  document.documentElement.style.setProperty("--pm-font-size", fontSize);
}

/**
 * Apply border radius to document
 */
export function applyBorderRadius(borderRadius: string): void {
  if (typeof document === "undefined") return;

  document.documentElement.style.setProperty(
    "--pm-border-radius",
    borderRadius,
  );
}
