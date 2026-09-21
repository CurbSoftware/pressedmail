/**
 * Theme colour tokens.
 *
 * The bag of CSS custom properties a palette defines, shared by both editions'
 * type surfaces: the Pro palette registry, the whitelabel runtime contract, the
 * admin settings draft and the Free brand-theme stub all type against it.
 *
 * It lives in `src/types/` rather than beside the palette registry because that
 * registry is Pro-only and the Free build never compiles it. A type import is
 * erased by Rollup but still names its module, so declaring the interface there
 * published 1600 lines of premium palettes as Free source.
 */

export interface ThemeColorVariables {
  // Core ShadCN variables (OKLCH format)
  "--background": string;
  "--foreground": string;
  "--card": string;
  "--card-foreground": string;
  "--popover": string;
  "--popover-foreground": string;
  "--primary": string;
  "--primary-foreground": string;
  "--secondary": string;
  "--secondary-foreground": string;
  "--muted": string;
  "--muted-foreground": string;
  "--accent": string;
  "--accent-foreground": string;
  "--destructive": string;
  "--destructive-foreground": string;
  "--destructive-border": string;
  // Status colours used as TEXT rather than as a fill.
  //
  // The fills are tuned for white foreground on top of them, which makes them
  // far too light to read as text: on the default dark palette text-warning
  // measured 3.23:1 on the card and text-destructive 4.10:1, and the worst
  // palette reached 2.92:1. These are the same hues at a lightness chosen for
  // the surface, so they differ between light and dark.
  "--success-text": string;
  "--warning-text": string;
  "--info-text": string;
  "--destructive-text": string;
  "--primary-text": string;
  "--success": string;
  "--success-foreground": string;
  "--success-border": string;
  "--warning": string;
  "--warning-foreground": string;
  "--warning-border": string;
  "--info": string;
  "--info-foreground": string;
  "--info-border": string;
  "--border": string;
  "--input": string;
  "--ring": string;
  "--radius": string;
  // Checkbox tokens: keep Kit UI checkboxes visible across every palette
  // (light + dark) without depending on --input contrast. Always required so
  // a missing value is a type error at the palette definition site.
  "--checkbox-border": string;
  "--checkbox-background": string;
  "--checkbox-checked-background": string;
  "--checkbox-checked-foreground": string;
  // Chart colors
  "--chart-1": string;
  "--chart-2": string;
  "--chart-3": string;
  "--chart-4": string;
  "--chart-5": string;
  // Sidebar colors (optional)
  "--sidebar-background"?: string;
  "--sidebar-foreground"?: string;
  "--sidebar-primary"?: string;
  "--sidebar-primary-foreground"?: string;
  "--sidebar-accent"?: string;
  "--sidebar-accent-foreground"?: string;
  "--sidebar-border"?: string;
  "--sidebar-ring"?: string;
}
