/**
 * Theme Variables Registry
 *
 * Centralized OKLCH color values for all themes.
 * These are applied via JavaScript to override CSS cascade issues.
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

export const SEMANTIC_STATUS_TOKEN_KEYS = [
  "--success",
  "--success-foreground",
  "--success-border",
  "--warning",
  "--warning-foreground",
  "--warning-border",
  "--info",
  "--info-foreground",
  "--info-border",
  "--destructive",
  "--destructive-foreground",
  "--destructive-border",
] as const satisfies readonly (keyof ThemeColorVariables)[];

type SemanticStatusTokenKey = (typeof SEMANTIC_STATUS_TOKEN_KEYS)[number];
type SemanticStatusTokens = Pick<ThemeColorVariables, SemanticStatusTokenKey>;
type GeneratedStatusTokenKey = Exclude<
  SemanticStatusTokenKey,
  "--destructive" | "--destructive-foreground"
>;
type GeneratedStatusTokens = Pick<ThemeColorVariables, GeneratedStatusTokenKey>;
type CheckedCheckboxTokenKey =
  | "--checkbox-checked-background"
  | "--checkbox-checked-foreground";
type ThemeColorVariableInputBase = Omit<
  ThemeColorVariables,
  SemanticStatusTokenKey | CheckedCheckboxTokenKey
>;
type LightThemeColorVariableInput = ThemeColorVariableInputBase &
  Pick<SemanticStatusTokens, "--destructive" | "--destructive-foreground"> &
  Partial<GeneratedStatusTokens>;
type DarkThemeColorVariableInput = ThemeColorVariableInputBase;

export interface ThemeDefinition {
  id: string;
  name: string;
  light: ThemeColorVariables;
  dark: ThemeColorVariables;
}

/**
 * Per-theme status hues. Status semantics (green = safe, amber = caution,
 * blue = info, red = danger) are fixed, but each palette nudges the exact
 * hue toward its own family so status colors feel native to the theme while
 * staying recognizable. `chromaScale` lets low-chroma palettes (minimalist)
 * dial saturation down.
 */
export interface StatusHues {
  success: number;
  warning: number;
  info: number;
  destructive: number;
  chromaScale?: number;
}

interface ThemeDefinitionInput {
  id: string;
  name: string;
  light: LightThemeColorVariableInput;
  dark: DarkThemeColorVariableInput;
  /** Optional bespoke status hues; falls back to DEFAULT_STATUS_HUES. */
  statusHues?: StatusHues;
}

const DEFAULT_STATUS_HUES: StatusHues = {
  success: 150,
  warning: 70,
  info: 255,
  destructive: 27,
};

/** Round a scaled chroma to keep the emitted OKLCH strings tidy. */
function scaleChroma(base: number, scale: number): number {
  return Math.round(base * scale * 1000) / 1000;
}

/**
 * Build the status defaults for one theme from its hues.
 *
 * Fill lightness is capped at 0.52 because every status foreground is white:
 * at 0.58 the green and cyan fills only reached about 4.0:1, and the greens run
 * from hue 145 to 162 across the palettes. 0.52 clears AA (4.5:1) at every hue
 * in use, so a palette can nudge its hues without re-measuring.
 */
function buildStatusTokens(hues: StatusHues): GeneratedStatusTokens {
  const s = hues.chromaScale ?? 1;
  const c = (base: number) => scaleChroma(base, s);

  return {
    "--success": `oklch(0.52 ${c(0.16)} ${hues.success})`,
    "--success-foreground": "oklch(1 0 0)",
    "--success-border": `oklch(0.5 ${c(0.15)} ${hues.success})`,
    "--warning": `oklch(0.5 ${c(0.13)} ${hues.warning})`,
    "--warning-foreground": "oklch(1 0 0)",
    "--warning-border": `oklch(0.46 ${c(0.12)} ${hues.warning})`,
    "--info": `oklch(0.52 ${c(0.17)} ${hues.info})`,
    "--info-foreground": "oklch(1 0 0)",
    "--info-border": `oklch(0.48 ${c(0.16)} ${hues.info})`,
    "--destructive-border": `oklch(0.5 ${c(0.2)} ${hues.destructive})`,
  };
}

function withStatusTokens(theme: ThemeDefinitionInput): ThemeDefinition {
  const lightBase = {
    ...buildStatusTokens(theme.statusHues ?? DEFAULT_STATUS_HUES),
    ...theme.light,
  } satisfies Omit<ThemeColorVariables, CheckedCheckboxTokenKey>;
  const sharedStatusTokens = Object.fromEntries(
    SEMANTIC_STATUS_TOKEN_KEYS.map((token) => [token, lightBase[token]]),
  ) as SemanticStatusTokens;
  const darkBase = {
    ...theme.dark,
    ...sharedStatusTokens,
  } satisfies Omit<ThemeColorVariables, CheckedCheckboxTokenKey>;
  const checkedCheckboxTokens = {
    "--checkbox-checked-background": lightBase["--primary"],
    "--checkbox-checked-foreground": lightBase["--primary-foreground"],
  } satisfies Pick<ThemeColorVariables, CheckedCheckboxTokenKey>;

  return {
    ...theme,
    light: {
      ...lightBase,
      ...checkedCheckboxTokens,
    },
    dark: {
      ...darkBase,
      ...checkedCheckboxTokens,
    },
  };
}

/**
 * Default Theme - PressedMail website palette with accessible dark actions
 */
const defaultTheme: ThemeDefinitionInput = {
  id: "pressedm",
  name: "PressedM",
  // PressedMail website palette: cyan/blue primary → info leans cyan.
  statusHues: { success: 145, warning: 85, info: 222, destructive: 27 },
  light: {
    "--radius": "0.5rem",
    "--background": "oklch(0.98 0.004 236.496)",
    "--foreground": "oklch(0.194 0.039 255.586)",
    "--muted": "oklch(0.957 0.003 247.859)",
    "--muted-foreground": "oklch(0.422 0.05 255.24)",
    "--popover": "oklch(1 0 0)",
    "--popover-foreground": "oklch(0.194 0.039 255.586)",
    "--card": "oklch(1 0 0)",
    "--card-foreground": "oklch(0.194 0.039 255.586)",
    "--border": "oklch(0.894 0.008 228.864)",
    "--input": "oklch(0.62 0.008 228.864)",
    "--checkbox-border": "oklch(0.691 0.023 236.924)",
    "--checkbox-background": "transparent",
    "--primary": "oklch(0.52 0.11 222)",
    "--primary-foreground": "oklch(0.98 0.02 201)",
    "--secondary": "oklch(0.957 0.003 247.859)",
    "--secondary-foreground": "oklch(0.194 0.039 255.586)",
    "--accent": "oklch(0.962 0.008 241.664)",
    "--accent-foreground": "oklch(0.194 0.039 255.586)",
    "--destructive": "oklch(0.577 0.245 27.325)",
    "--destructive-foreground": "oklch(1 0 0)",
    "--ring": "oklch(0.594 0.081 242.775)",
    "--chart-1": "oklch(0.87 0.12 207)",
    "--chart-2": "oklch(0.8 0.13 212)",
    "--chart-3": "oklch(0.71 0.13 215)",
    "--chart-4": "oklch(0.61 0.11 222)",
    "--chart-5": "oklch(0.52 0.09 223)",
    "--sidebar-background": "oklch(0.979 0.002 247.839)",
    "--sidebar-foreground": "oklch(0.194 0.039 255.586)",
    "--sidebar-primary": "oklch(0.52 0.11 222)",
    "--sidebar-primary-foreground": "oklch(0.98 0.02 201)",
    "--sidebar-accent": "oklch(0.962 0.008 241.664)",
    "--sidebar-accent-foreground": "oklch(0.194 0.039 255.586)",
    "--sidebar-border": "oklch(0.894 0.008 228.864)",
    "--sidebar-ring": "oklch(0.594 0.081 242.775)",
  },
  dark: {
    "--radius": "0.5rem",
    "--background": "oklch(0.118 0.017 243.68)",
    "--foreground": "oklch(0.98 0.004 236.496)",
    "--muted": "oklch(0.257 0.025 253.728)",
    "--muted-foreground": "oklch(0.827 0.012 231.689)",
    "--popover": "oklch(0.156 0.026 252.034)",
    "--popover-foreground": "oklch(0.98 0.004 236.496)",
    "--card": "oklch(0.156 0.026 252.034)",
    "--card-foreground": "oklch(0.98 0.004 236.496)",
    "--border": "oklch(0.901 0.019 242.985 / 14%)",
    "--input": "oklch(0.901 0.019 242.985 / 18%)",
    "--checkbox-border": "oklch(0.84 0.031 238.905 / 50%)",
    "--checkbox-background": "transparent",
    // Website primary is oklch(0.61 0.11 222); darkened to 0.52 in both modes
    // so the website near-white --primary-foreground clears WCAG AA (4.96:1).
    "--primary": "oklch(0.52 0.11 222)",
    "--primary-foreground": "oklch(0.98 0.02 201)",
    "--secondary": "oklch(0.257 0.025 253.728)",
    "--secondary-foreground": "oklch(0.98 0.004 236.496)",
    "--accent": "oklch(0.302 0.033 255.78)",
    "--accent-foreground": "oklch(0.98 0.004 236.496)",
    "--ring": "oklch(0.718 0.056 240.941)",
    "--chart-1": "oklch(0.87 0.12 207)",
    "--chart-2": "oklch(0.8 0.13 212)",
    "--chart-3": "oklch(0.71 0.13 215)",
    "--chart-4": "oklch(0.61 0.11 222)",
    "--chart-5": "oklch(0.52 0.09 223)",
    "--sidebar-background": "oklch(0.138 0.021 253.965)",
    "--sidebar-foreground": "oklch(0.98 0.004 236.496)",
    "--sidebar-primary": "oklch(0.52 0.11 222)",
    "--sidebar-primary-foreground": "oklch(0.98 0.02 201)",
    "--sidebar-accent": "oklch(0.257 0.025 253.728)",
    "--sidebar-accent-foreground": "oklch(0.98 0.004 236.496)",
    "--sidebar-border": "oklch(0.901 0.019 242.985 / 12%)",
    "--sidebar-ring": "oklch(0.718 0.056 240.941)",
  },
};

/**
 * Curb Theme - CurbSoftware brand amber on neutral zinc, light and dark variants
 */
const curbTheme: ThemeDefinitionInput = {
  id: "curb",
  name: "CurbPress",
  // Amber brand → warning skews golden.
  statusHues: { success: 150, warning: 80, info: 255, destructive: 27 },
  light: {
    "--radius": "0.5rem",
    "--background": "oklch(0.99 0.001 286)",
    "--foreground": "oklch(0.141 0.005 285.823)",
    "--muted": "oklch(0.945 0.003 286.375)",
    "--muted-foreground": "oklch(0.276 0.016 285.938)",
    "--popover": "oklch(1 0 0)",
    "--popover-foreground": "oklch(0.141 0.005 285.823)",
    "--card": "oklch(1 0 0)",
    "--card-foreground": "oklch(0.141 0.005 285.823)",
    "--border": "oklch(0.875 0.006 286.32)",
    "--input": "oklch(0.62 0.006 286.32)",
    "--checkbox-border": "oklch(0.78 0.006 286.32)",
    "--checkbox-background": "transparent",
    "--primary": "oklch(0.68 0.18 75)",
    "--primary-foreground": "oklch(0.15 0.04 75)",
    "--secondary": "oklch(0.955 0.002 286.375)",
    "--secondary-foreground": "oklch(0.21 0.006 285.885)",
    "--accent": "oklch(0.955 0.002 286.375)",
    "--accent-foreground": "oklch(0.21 0.006 285.885)",
    "--destructive": "oklch(0.577 0.245 27.325)",
    "--destructive-foreground": "oklch(1 0 0)",
    "--ring": "oklch(0.6 0.15 75)",
    "--chart-1": "oklch(0.87 0.1 80)",
    "--chart-2": "oklch(0.8 0.14 78)",
    "--chart-3": "oklch(0.73 0.17 76)",
    "--chart-4": "oklch(0.68 0.18 75)",
    "--chart-5": "oklch(0.55 0.15 74)",
  },
  dark: {
    "--radius": "0.5rem",
    "--background": "oklch(0.1 0.004 285.823)",
    "--foreground": "oklch(0.985 0 0)",
    "--muted": "oklch(0.185 0.005 286.033)",
    "--muted-foreground": "oklch(0.8525 0.015 286.067)",
    "--popover": "oklch(0.135 0.005 285.885)",
    "--popover-foreground": "oklch(0.985 0 0)",
    "--card": "oklch(0.135 0.005 285.885)",
    "--card-foreground": "oklch(0.985 0 0)",
    "--border": "oklch(1 0 0 / 10%)",
    "--input": "oklch(1 0 0 / 15%)",
    "--checkbox-border": "oklch(1 0 0 / 25%)",
    "--checkbox-background": "transparent",
    "--primary": "oklch(0.75 0.18 75)",
    "--primary-foreground": "oklch(0.15 0.04 75)",
    "--secondary": "oklch(0.185 0.005 286.033)",
    "--secondary-foreground": "oklch(0.985 0 0)",
    "--accent": "oklch(0.185 0.005 286.033)",
    "--accent-foreground": "oklch(0.85 0.15 85)",
    "--ring": "oklch(0.75 0.15 75)",
    "--chart-1": "oklch(0.87 0.1 80)",
    "--chart-2": "oklch(0.8 0.14 78)",
    "--chart-3": "oklch(0.73 0.17 76)",
    "--chart-4": "oklch(0.68 0.18 75)",
    "--chart-5": "oklch(0.55 0.15 74)",
  },
};

/**
 * Pretty Theme - CurbPress recolored with a rose-pink accent and soft rose
 * surfaces for a lighter, more feminine UI. Pro tier.
 */
const prettyTheme: ThemeDefinitionInput = {
  id: "pretty",
  name: "Pretty",
  statusHues: { success: 150, warning: 80, info: 255, destructive: 27 },
  light: {
    "--radius": "0.5rem",
    "--background": "oklch(0.99 0.006 12)",
    "--foreground": "oklch(0.18 0.01 350)",
    "--muted": "oklch(0.955 0.018 12)",
    "--muted-foreground": "oklch(0.25 0.03 350)",
    "--popover": "oklch(1 0 0)",
    "--popover-foreground": "oklch(0.18 0.01 350)",
    "--card": "oklch(1 0 0)",
    "--card-foreground": "oklch(0.18 0.01 350)",
    "--border": "oklch(0.9 0.02 10)",
    "--input": "oklch(0.62 0.02 10)",
    "--checkbox-border": "oklch(0.8 0.03 10)",
    "--checkbox-background": "transparent",
    "--primary": "oklch(0.55 0.22 350)",
    "--primary-foreground": "oklch(0.99 0.005 350)",
    "--secondary": "oklch(0.969 0.015 12.422)",
    "--secondary-foreground": "oklch(0.25 0.03 350)",
    "--accent": "oklch(0.969 0.015 12.422)",
    "--accent-foreground": "oklch(0.25 0.03 350)",
    "--destructive": "oklch(0.577 0.245 27.325)",
    "--destructive-foreground": "oklch(1 0 0)",
    "--ring": "oklch(0.55 0.18 350)",
    "--chart-1": "oklch(0.8 0.1 350)",
    "--chart-2": "oklch(0.72 0.16 345)",
    "--chart-3": "oklch(0.62 0.2 350)",
    "--chart-4": "oklch(0.58 0.18 330)",
    "--chart-5": "oklch(0.5 0.16 355)",
  },
  dark: {
    "--radius": "0.5rem",
    "--background": "oklch(0.13 0.012 350)",
    "--foreground": "oklch(0.985 0.004 350)",
    "--muted": "oklch(0.2 0.012 350)",
    "--muted-foreground": "oklch(0.86 0.03 350)",
    "--popover": "oklch(0.16 0.012 350)",
    "--popover-foreground": "oklch(0.985 0.004 350)",
    "--card": "oklch(0.16 0.012 350)",
    "--card-foreground": "oklch(0.985 0.004 350)",
    "--border": "oklch(1 0 0 / 12%)",
    "--input": "oklch(1 0 0 / 15%)",
    "--checkbox-border": "oklch(1 0 0 / 25%)",
    "--checkbox-background": "transparent",
    "--primary": "oklch(0.68 0.2 350)",
    "--primary-foreground": "oklch(0.16 0.04 350)",
    "--secondary": "oklch(0.2 0.012 350)",
    "--secondary-foreground": "oklch(0.985 0.004 350)",
    "--accent": "oklch(0.2 0.012 350)",
    "--accent-foreground": "oklch(0.82 0.14 350)",
    "--ring": "oklch(0.68 0.16 350)",
    "--chart-1": "oklch(0.8 0.1 350)",
    "--chart-2": "oklch(0.72 0.16 345)",
    "--chart-3": "oklch(0.62 0.2 350)",
    "--chart-4": "oklch(0.58 0.18 330)",
    "--chart-5": "oklch(0.5 0.16 355)",
  },
};

/**
 * Tokyo Theme - Neon cyberpunk aesthetic
 */
const tokyoTheme: ThemeDefinitionInput = {
  id: "tokyo",
  name: "Tokyo Night",
  // Neon cyberpunk → cool, vivid statuses.
  statusHues: { success: 152, warning: 75, info: 256, destructive: 25 },
  light: {
    "--radius": "0.5rem",
    "--background": "oklch(1 0 180)",
    "--foreground": "oklch(0.137 0.036 258.526)",
    "--muted": "oklch(0.968 0.007 247.895)",
    "--muted-foreground": "oklch(0.225 0.041 257.44)",
    "--popover": "oklch(1 0 180)",
    "--popover-foreground": "oklch(0.137 0.036 258.526)",
    "--card": "oklch(1 0 180)",
    "--card-foreground": "oklch(0.137 0.036 258.526)",
    "--border": "oklch(0.929 0.013 255.532)",
    "--input": "oklch(0.62 0.025 256)",
    "--checkbox-border": "oklch(0.78 0.02 255.532)",
    "--checkbox-background": "transparent",
    "--primary": "oklch(0.419 0.199 262.534)",
    "--primary-foreground": "oklch(0.984 0.003 247.859)",
    "--secondary": "oklch(0.968 0.007 247.895)",
    "--secondary-foreground": "oklch(0.208 0.04 265.727)",
    "--accent": "oklch(0.968 0.007 247.895)",
    "--accent-foreground": "oklch(0.208 0.04 265.727)",
    "--destructive": "oklch(0.58 0.238 27.654)",
    "--destructive-foreground": "oklch(0.984 0.003 247.859)",
    "--ring": "oklch(0.418 0.199 262.612)",
    "--chart-1": "oklch(0.419 0.199 262.534)",
    "--chart-2": "oklch(0.968 0.007 247.895)",
    "--chart-3": "oklch(0.968 0.007 247.895)",
    "--chart-4": "oklch(0.993 0.002 247.838)",
    "--chart-5": "oklch(0.419 0.204 262.504)",
  },
  dark: {
    "--radius": "0.5rem",
    "--background": "oklch(0.203 0.014 285.102)",
    "--foreground": "oklch(0.766 0.049 276.035)",
    "--muted": "oklch(0.286 0.023 278.46)",
    "--muted-foreground": "oklch(0.875 0.04 279.856)",
    "--popover": "oklch(0.226 0.019 280.253)",
    "--popover-foreground": "oklch(0.766 0.049 276.035)",
    "--card": "oklch(0.226 0.019 280.253)",
    "--card-foreground": "oklch(0.766 0.049 276.035)",
    "--border": "oklch(0.396 0.036 278.297)",
    "--input": "oklch(0.248 0.025 277.622)",
    "--checkbox-border": "oklch(0.6 0.036 278.297)",
    "--checkbox-background": "transparent",
    "--primary": "oklch(0.867 0 180)",
    "--primary-foreground": "oklch(0.321 0 180)",
    "--secondary": "oklch(0.718 0.113 269.854)",
    "--secondary-foreground": "oklch(0.226 0.019 280.253)",
    "--accent": "oklch(0.197 0.016 280.374)",
    "--accent-foreground": "oklch(0.867 0 180)",
    "--ring": "oklch(0.718 0.113 269.854)",
    "--chart-1": "oklch(0.867 0 180)",
    "--chart-2": "oklch(0.718 0.113 269.854)",
    "--chart-3": "oklch(0.197 0.016 280.374)",
    "--chart-4": "oklch(0.749 0.1 270.243)",
    "--chart-5": "oklch(0.865 0.003 17.214)",
  },
};

/**
 * PressedOut Theme - Outlook-inspired Fluent Design
 */
const pressedoutTheme: ThemeDefinitionInput = {
  id: "pressedout",
  name: "PressedOut",
  // Outlook blue → info matches the primary blue.
  statusHues: { success: 150, warning: 70, info: 259, destructive: 25 },
  light: {
    "--radius": "0.625rem",
    "--background": "oklch(1 0 0)",
    "--foreground": "oklch(0.3211 0 0)",
    "--card": "oklch(1 0 0)",
    "--card-foreground": "oklch(0.3211 0 0)",
    "--popover": "oklch(1 0 0)",
    "--popover-foreground": "oklch(0.3211 0 0)",
    "--primary": "oklch(0.56 0.188 259.8145)",
    "--primary-foreground": "oklch(1 0 0)",
    "--secondary": "oklch(0.967 0.0029 264.5419)",
    "--secondary-foreground": "oklch(0.4461 0.0263 256.8018)",
    "--muted": "oklch(0.9846 0.0017 247.8389)",
    "--muted-foreground": "oklch(0.225 0.0234 264.3637)",
    "--accent": "oklch(0.9514 0.025 236.8242)",
    "--accent-foreground": "oklch(0.3791 0.1378 265.5222)",
    "--destructive": "oklch(0.58 0.2078 25.3313)",
    "--destructive-foreground": "oklch(1 0 0)",
    "--border": "oklch(0.9276 0.0058 264.5313)",
    "--input": "oklch(0.62 0.012 264)",
    "--checkbox-border": "oklch(0.78 0.012 264.5313)",
    "--checkbox-background": "transparent",
    "--ring": "oklch(0.6231 0.188 259.8145)",
    "--chart-1": "oklch(0.6231 0.188 259.8145)",
    "--chart-2": "oklch(0.5461 0.2152 262.8809)",
    "--chart-3": "oklch(0.4882 0.2172 264.3763)",
    "--chart-4": "oklch(0.4244 0.1809 265.6377)",
    "--chart-5": "oklch(0.3791 0.1378 265.5222)",
    "--sidebar-background": "oklch(0.9846 0.0017 247.8389)",
    "--sidebar-foreground": "oklch(0.3211 0 0)",
    "--sidebar-primary": "oklch(0.56 0.188 259.8145)",
    "--sidebar-primary-foreground": "oklch(1 0 0)",
    "--sidebar-accent": "oklch(0.9514 0.025 236.8242)",
    "--sidebar-accent-foreground": "oklch(0.3791 0.1378 265.5222)",
    "--sidebar-border": "oklch(0.9276 0.0058 264.5313)",
    "--sidebar-ring": "oklch(0.6231 0.188 259.8145)",
  },
  dark: {
    "--radius": "0.625rem",
    "--background": "oklch(0.2046 0 0)",
    "--foreground": "oklch(0.9219 0 0)",
    "--card": "oklch(0.2564 0 0)",
    "--card-foreground": "oklch(0.9219 0 0)",
    "--popover": "oklch(0.2564 0 0)",
    "--popover-foreground": "oklch(0.9219 0 0)",
    "--primary": "oklch(0.56 0.188 259.8145)",
    "--primary-foreground": "oklch(1 0 0)",
    "--secondary": "oklch(0.3209 0 0)",
    "--secondary-foreground": "oklch(0.9219 0 0)",
    "--muted": "oklch(0.2564 0 0)",
    "--muted-foreground": "oklch(0.875 0 0)",
    "--accent": "oklch(0.3791 0.1378 265.5222)",
    "--accent-foreground": "oklch(0.8587 0.0813 251.8514)",
    "--border": "oklch(0.3671 0 0)",
    "--input": "oklch(0.3671 0 0)",
    "--checkbox-border": "oklch(0.62 0 0)",
    "--checkbox-background": "transparent",
    "--ring": "oklch(0.6231 0.188 259.8145)",
    "--chart-1": "oklch(0.6231 0.188 259.8145)",
    "--chart-2": "oklch(0.5461 0.2152 262.8809)",
    "--chart-3": "oklch(0.4882 0.2172 264.3763)",
    "--chart-4": "oklch(0.4244 0.1809 265.6377)",
    "--chart-5": "oklch(0.3791 0.1378 265.5222)",
    "--sidebar-background": "oklch(0.2046 0 0)",
    "--sidebar-foreground": "oklch(0.9219 0 0)",
    "--sidebar-primary": "oklch(0.56 0.188 259.8145)",
    "--sidebar-primary-foreground": "oklch(1 0 0)",
    "--sidebar-accent": "oklch(0.3791 0.1378 265.5222)",
    "--sidebar-accent-foreground": "oklch(0.8587 0.0813 251.8514)",
    "--sidebar-border": "oklch(0.3671 0 0)",
    "--sidebar-ring": "oklch(0.6231 0.188 259.8145)",
  },
};

/**
 * PressedG Theme - Gmail-inspired Material Design
 */
const pressedgTheme: ThemeDefinitionInput = {
  id: "pressedg",
  name: "PressedG",
  // Gmail red → danger hue matches primary; info leans Google blue.
  statusHues: { success: 149, warning: 70, info: 262, destructive: 25 },
  light: {
    "--radius": "1rem",
    "--background": "oklch(1 0 0)",
    "--foreground": "oklch(0.3211 0 0)",
    "--card": "oklch(1 0 0)",
    "--card-foreground": "oklch(0.3211 0 0)",
    "--popover": "oklch(1 0 0)",
    "--popover-foreground": "oklch(0.3211 0 0)",
    "--primary": "oklch(0.58 0.1777 27.8279)",
    "--primary-foreground": "oklch(1 0 0)",
    "--secondary": "oklch(0.9578 0.0054 106.0409)",
    "--secondary-foreground": "oklch(0.3211 0 0)",
    "--muted": "oklch(0.9846 0.0017 247.8389)",
    "--muted-foreground": "oklch(0.225 0.0234 264.3637)",
    "--accent": "oklch(0.9514 0.0162 106.0882)",
    "--accent-foreground": "oklch(0.3211 0 0)",
    "--destructive": "oklch(0.58 0.2078 25.3313)",
    "--destructive-foreground": "oklch(1 0 0)",
    "--border": "oklch(0.9276 0.0058 264.5313)",
    "--input": "oklch(0.62 0.018 264)",
    "--checkbox-border": "oklch(0.78 0.012 264.5313)",
    "--checkbox-background": "transparent",
    "--ring": "oklch(0.6062 0.1777 27.8279)",
    "--chart-1": "oklch(0.6062 0.1777 27.8279)",
    "--chart-2": "oklch(0.7013 0.1358 149.214)",
    "--chart-3": "oklch(0.6475 0.1769 262.0542)",
    "--chart-4": "oklch(0.7955 0.1577 70.0804)",
    "--chart-5": "oklch(0.5889 0.1878 14.9861)",
  },
  dark: {
    "--radius": "1rem",
    "--background": "oklch(0.2046 0 0)",
    "--foreground": "oklch(0.9219 0 0)",
    "--card": "oklch(0.2564 0 0)",
    "--card-foreground": "oklch(0.9219 0 0)",
    "--popover": "oklch(0.2564 0 0)",
    "--popover-foreground": "oklch(0.9219 0 0)",
    "--primary": "oklch(0.6956 0.1642 27.9263)",
    "--primary-foreground": "oklch(0.2046 0 0)",
    "--secondary": "oklch(0.3209 0 0)",
    "--secondary-foreground": "oklch(0.9219 0 0)",
    "--muted": "oklch(0.2564 0 0)",
    "--muted-foreground": "oklch(0.875 0 0)",
    "--accent": "oklch(0.3671 0 0)",
    "--accent-foreground": "oklch(0.9219 0 0)",
    "--border": "oklch(0.3671 0 0)",
    "--input": "oklch(0.3671 0 0)",
    "--checkbox-border": "oklch(0.62 0 0)",
    "--checkbox-background": "transparent",
    "--ring": "oklch(0.6956 0.1642 27.9263)",
    "--chart-1": "oklch(0.6956 0.1642 27.9263)",
    "--chart-2": "oklch(0.7013 0.1358 149.214)",
    "--chart-3": "oklch(0.6475 0.1769 262.0542)",
    "--chart-4": "oklch(0.7955 0.1577 70.0804)",
    "--chart-5": "oklch(0.5889 0.1878 14.9861)",
  },
};

/**
 * PressedCube Theme - Roundcube-inspired classic webmail
 */
const pressedcubeTheme: ThemeDefinitionInput = {
  id: "pressedcube",
  name: "PressedCube",
  // Receives the original PressedM indigo palette (theme color swap).
  statusHues: { success: 150, warning: 70, info: 264, destructive: 27 },
  light: {
    "--radius": "0.5rem",
    "--background": "oklch(1 0 0)",
    "--foreground": "oklch(0.141 0.005 285.823)",
    "--muted": "oklch(0.967 0.001 286.375)",
    "--muted-foreground": "oklch(0.225 0.016 285.938)",
    "--popover": "oklch(1 0 0)",
    "--popover-foreground": "oklch(0.141 0.005 285.823)",
    "--card": "oklch(1 0 0)",
    "--card-foreground": "oklch(0.141 0.005 285.823)",
    "--border": "oklch(0.92 0.004 286.32)",
    "--input": "oklch(0.62 0.004 286.32)",
    "--checkbox-border": "oklch(0.78 0.012 286.32)",
    "--checkbox-background": "transparent",
    "--primary": "oklch(0.57 0.233 264.052)",
    "--primary-foreground": "oklch(1 0 0)",
    "--secondary": "oklch(0.967 0.001 286.375)",
    "--secondary-foreground": "oklch(0.21 0.006 285.885)",
    "--accent": "oklch(0.967 0.001 286.375)",
    "--accent-foreground": "oklch(0.21 0.006 285.885)",
    "--destructive": "oklch(0.577 0.245 27.325)",
    "--destructive-foreground": "oklch(1 0 0)",
    "--ring": "oklch(0.585 0.233 264.052)",
    "--chart-1": "oklch(0.585 0.233 264.052)",
    "--chart-2": "oklch(0.552 0.016 285.938)",
    "--chart-3": "oklch(0.967 0.001 286.375)",
    "--chart-4": "oklch(0.92 0.004 286.32)",
    "--chart-5": "oklch(0.588 0.236 264.376)",
  },
  dark: {
    "--radius": "0.5rem",
    "--background": "oklch(0.141 0.005 285.823)",
    "--foreground": "oklch(0.985 0 0)",
    "--muted": "oklch(0.274 0.006 286.033)",
    "--muted-foreground": "oklch(0.875 0.015 286.067)",
    "--popover": "oklch(0.21 0.006 285.885)",
    "--popover-foreground": "oklch(0.985 0 0)",
    "--card": "oklch(0.21 0.006 285.885)",
    "--card-foreground": "oklch(0.985 0 0)",
    "--border": "oklch(1 0 0 / 10%)",
    "--input": "oklch(1 0 0 / 15%)",
    "--checkbox-border": "oklch(0.62 0.015 286.067)",
    "--checkbox-background": "transparent",
    "--primary": "oklch(0.707 0.165 254.624)",
    "--primary-foreground": "oklch(0.3 0.05 260)",
    "--secondary": "oklch(0.274 0.006 286.033)",
    "--secondary-foreground": "oklch(0.985 0 0)",
    "--accent": "oklch(0.274 0.006 286.033)",
    "--accent-foreground": "oklch(0.985 0 0)",
    "--ring": "oklch(0.552 0.016 285.938)",
    "--chart-1": "oklch(0.707 0.165 254.624)",
    "--chart-2": "oklch(0.705 0.015 286.067)",
    "--chart-3": "oklch(0.274 0.006 286.033)",
    "--chart-4": "oklch(0.92 0.004 286.32)",
    "--chart-5": "oklch(0.588 0.236 264.376)",
  },
};

/**
 * Executive Theme - Corporate green, blue & grey
 */
const executiveTheme: ThemeDefinitionInput = {
  id: "executive",
  name: "Executive",
  // Corporate green primary → success matches the brand green.
  statusHues: { success: 162, warning: 70, info: 259, destructive: 25 },
  light: {
    "--radius": "0.5rem",
    "--background": "oklch(1 0 0)",
    "--foreground": "oklch(0.2046 0 0)",
    "--card": "oklch(1 0 0)",
    "--card-foreground": "oklch(0.2046 0 0)",
    "--popover": "oklch(1 0 0)",
    "--popover-foreground": "oklch(0.2046 0 0)",
    "--primary": "oklch(0.5068 0.1347 166.1131)",
    "--primary-foreground": "oklch(1 0 0)",
    "--secondary": "oklch(0.56 0.188 259.8145)",
    "--secondary-foreground": "oklch(1 0 0)",
    "--muted": "oklch(0.9578 0.0054 247.8389)",
    "--muted-foreground": "oklch(0.225 0.0234 264.3637)",
    "--accent": "oklch(0.9514 0.0162 166.0)",
    "--accent-foreground": "oklch(0.2046 0 0)",
    "--destructive": "oklch(0.58 0.2078 25.3313)",
    "--destructive-foreground": "oklch(1 0 0)",
    "--border": "oklch(0.9276 0.0058 264.5313)",
    "--input": "oklch(0.62 0.02 260)",
    "--checkbox-border": "oklch(0.78 0.012 264.5313)",
    "--checkbox-background": "transparent",
    "--ring": "oklch(0.5068 0.1347 166.1131)",
    "--chart-1": "oklch(0.5068 0.1347 166.1131)",
    "--chart-2": "oklch(0.6231 0.188 259.8145)",
    "--chart-3": "oklch(0.551 0.0234 264.3637)",
    "--chart-4": "oklch(0.7299 0.1466 166.0)",
    "--chart-5": "oklch(0.7083 0.1509 259.0)",
  },
  dark: {
    "--radius": "0.5rem",
    "--background": "oklch(0.1665 0 0)",
    "--foreground": "oklch(0.9578 0 0)",
    "--card": "oklch(0.2046 0 0)",
    "--card-foreground": "oklch(0.9578 0 0)",
    "--popover": "oklch(0.2046 0 0)",
    "--popover-foreground": "oklch(0.9578 0 0)",
    "--primary": "oklch(0.6493 0.1473 163.2339)",
    "--primary-foreground": "oklch(0.1665 0 0)",
    "--secondary": "oklch(0.56 0.188 259.8145)",
    "--secondary-foreground": "oklch(1 0 0)",
    "--muted": "oklch(0.2564 0 0)",
    "--muted-foreground": "oklch(0.875 0 0)",
    "--accent": "oklch(0.3209 0.05 166.0)",
    "--accent-foreground": "oklch(0.9578 0 0)",
    "--border": "oklch(0.3671 0 0)",
    "--input": "oklch(0.3671 0 0)",
    "--checkbox-border": "oklch(0.62 0 0)",
    "--checkbox-background": "transparent",
    "--ring": "oklch(0.6493 0.1473 163.2339)",
    "--chart-1": "oklch(0.6493 0.1473 163.2339)",
    "--chart-2": "oklch(0.6231 0.188 259.8145)",
    "--chart-3": "oklch(0.6614 0 0)",
    "--chart-4": "oklch(0.7299 0.1466 166.0)",
    "--chart-5": "oklch(0.7083 0.1509 259.0)",
  },
};

/**
 * Minimalist Theme - Ultra-clean black & white
 */
const minimalistTheme: ThemeDefinitionInput = {
  id: "minimalist",
  name: "Minimalist",
  // Ultra-clean mono → keep status hues canonical but desaturated.
  statusHues: {
    success: 150,
    warning: 70,
    info: 255,
    destructive: 27,
    chromaScale: 0.7,
  },
  light: {
    "--radius": "0.25rem",
    "--background": "oklch(0.9956 0 0)",
    "--foreground": "oklch(0.1665 0 0)",
    "--card": "oklch(1 0 0)",
    "--card-foreground": "oklch(0.1665 0 0)",
    "--popover": "oklch(1 0 0)",
    "--popover-foreground": "oklch(0.1665 0 0)",
    "--primary": "oklch(0.1665 0 0)",
    "--primary-foreground": "oklch(0.9956 0 0)",
    "--secondary": "oklch(0.9219 0 0)",
    "--secondary-foreground": "oklch(0.1665 0 0)",
    "--muted": "oklch(0.9578 0 0)",
    "--muted-foreground": "oklch(0.225 0 0)",
    "--accent": "oklch(0.9578 0 0)",
    "--accent-foreground": "oklch(0.1665 0 0)",
    "--destructive": "oklch(0.5772 0.2454 27.3252)",
    "--destructive-foreground": "oklch(1 0 0)",
    "--border": "oklch(0.9219 0 0)",
    "--input": "oklch(0.62 0.01 286)",
    "--checkbox-border": "oklch(0.75 0 0)",
    "--checkbox-background": "transparent",
    "--ring": "oklch(0.1665 0 0)",
    "--chart-1": "oklch(0.1665 0 0)",
    "--chart-2": "oklch(0.3671 0 0)",
    "--chart-3": "oklch(0.551 0 0)",
    "--chart-4": "oklch(0.7083 0 0)",
    "--chart-5": "oklch(0.8587 0 0)",
  },
  dark: {
    "--radius": "0.25rem",
    "--background": "oklch(0.1665 0 0)",
    "--foreground": "oklch(0.9956 0 0)",
    "--card": "oklch(0.2046 0 0)",
    "--card-foreground": "oklch(0.9956 0 0)",
    "--popover": "oklch(0.2046 0 0)",
    "--popover-foreground": "oklch(0.9956 0 0)",
    "--primary": "oklch(0.9956 0 0)",
    "--primary-foreground": "oklch(0.1665 0 0)",
    "--secondary": "oklch(0.2564 0 0)",
    "--secondary-foreground": "oklch(0.9956 0 0)",
    "--muted": "oklch(0.2564 0 0)",
    "--muted-foreground": "oklch(0.875 0 0)",
    "--accent": "oklch(0.2564 0 0)",
    "--accent-foreground": "oklch(0.9956 0 0)",
    "--border": "oklch(0.3209 0 0)",
    "--input": "oklch(0.3209 0 0)",
    "--checkbox-border": "oklch(0.65 0 0)",
    "--checkbox-background": "transparent",
    "--ring": "oklch(0.9956 0 0)",
    "--chart-1": "oklch(0.9956 0 0)",
    "--chart-2": "oklch(0.8587 0 0)",
    "--chart-3": "oklch(0.7083 0 0)",
    "--chart-4": "oklch(0.551 0 0)",
    "--chart-5": "oklch(0.3671 0 0)",
  },
};

/**
 * Contrast Theme - Black & white with exaggerated borders (near-black in light,
 * near-white in dark). Cloned from Minimalist; only the border tokens are
 * pushed, so all status/primary contrast guarantees carry over. Pro tier.
 */
const contrastTheme: ThemeDefinitionInput = {
  id: "contrast",
  name: "Contrast",
  statusHues: {
    success: 150,
    warning: 70,
    info: 255,
    destructive: 27,
    chromaScale: 0.7,
  },
  light: {
    "--radius": "0.25rem",
    // Page canvas sits a hair below pure white so white cards/popovers lift off
    // it; text and chrome are pushed to near-black for AAA legibility.
    "--background": "oklch(0.98 0 0)",
    "--foreground": "oklch(0.13 0 0)",
    "--card": "oklch(1 0 0)",
    "--card-foreground": "oklch(0.13 0 0)",
    "--popover": "oklch(1 0 0)",
    "--popover-foreground": "oklch(0.13 0 0)",
    "--primary": "oklch(0.13 0 0)",
    "--primary-foreground": "oklch(1 0 0)",
    "--secondary": "oklch(0.9 0 0)",
    "--secondary-foreground": "oklch(0.13 0 0)",
    "--muted": "oklch(0.945 0 0)",
    "--muted-foreground": "oklch(0.225 0 0)",
    "--accent": "oklch(0.93 0 0)",
    "--accent-foreground": "oklch(0.13 0 0)",
    "--destructive": "oklch(0.5772 0.2454 27.3252)",
    "--destructive-foreground": "oklch(1 0 0)",
    "--border": "oklch(0.13 0 0)",
    "--input": "oklch(0.13 0 0)",
    "--checkbox-border": "oklch(0.13 0 0)",
    "--checkbox-background": "transparent",
    "--ring": "oklch(0.13 0 0)",
    "--chart-1": "oklch(0.13 0 0)",
    "--chart-2": "oklch(0.3671 0 0)",
    "--chart-3": "oklch(0.551 0 0)",
    "--chart-4": "oklch(0.7083 0 0)",
    "--chart-5": "oklch(0.8587 0 0)",
  },
  dark: {
    "--radius": "0.25rem",
    // Canvas reads near-black; surfaces step up (background < card/popover <
    // muted < accent) so hierarchy survives without losing the deep contrast.
    "--background": "oklch(0.1 0 0)",
    "--foreground": "oklch(0.99 0 0)",
    "--card": "oklch(0.16 0 0)",
    "--card-foreground": "oklch(0.99 0 0)",
    "--popover": "oklch(0.16 0 0)",
    "--popover-foreground": "oklch(0.99 0 0)",
    "--primary": "oklch(0.99 0 0)",
    "--primary-foreground": "oklch(0.1 0 0)",
    "--secondary": "oklch(0.22 0 0)",
    "--secondary-foreground": "oklch(0.99 0 0)",
    "--muted": "oklch(0.2 0 0)",
    "--muted-foreground": "oklch(0.875 0 0)",
    "--accent": "oklch(0.24 0 0)",
    "--accent-foreground": "oklch(0.99 0 0)",
    "--border": "oklch(0.97 0 0)",
    "--input": "oklch(0.97 0 0)",
    "--checkbox-border": "oklch(0.97 0 0)",
    "--checkbox-background": "transparent",
    "--ring": "oklch(0.99 0 0)",
    "--chart-1": "oklch(0.99 0 0)",
    "--chart-2": "oklch(0.8587 0 0)",
    "--chart-3": "oklch(0.7083 0 0)",
    "--chart-4": "oklch(0.551 0 0)",
    "--chart-5": "oklch(0.3671 0 0)",
  },
};

/**
 * All theme definitions registry
 */
export const THEME_REGISTRY: Record<string, ThemeDefinition> = {
  pressedm: withStatusTokens(defaultTheme),
  curb: withStatusTokens(curbTheme),
  pretty: withStatusTokens(prettyTheme),
  tokyo: withStatusTokens(tokyoTheme),
  pressedout: withStatusTokens(pressedoutTheme),
  pressedg: withStatusTokens(pressedgTheme),
  pressedcube: withStatusTokens(pressedcubeTheme),
  executive: withStatusTokens(executiveTheme),
  minimalist: withStatusTokens(minimalistTheme),
  contrast: withStatusTokens(contrastTheme),
};

/**
 * The built-in palette was historically id "default"; it is now "pressedm".
 * Normalize stored/legacy values so old preferences keep resolving.
 */
export const LEGACY_THEME_ID_ALIASES: Record<string, string> = {
  default: "pressedm",
};

export function normalizeLegacyThemeId(themeId: string): string {
  return LEGACY_THEME_ID_ALIASES[themeId] ?? themeId;
}

/**
 * Get theme variables for a given theme ID and mode
 */
export function getThemeVariables(
  themeId: string,
  isDark: boolean,
): ThemeColorVariables | null {
  const theme = THEME_REGISTRY[themeId];
  if (!theme) return null;
  return isDark ? theme.dark : theme.light;
}

/**
 * Apply theme variables to the document root AND plugin wrapper
 * The pluginWrapper parameter allows applying variables directly to the plugin
 * container for maximum CSS specificity over WordPress admin styles.
 */
export function applyThemeVariables(
  themeId: string,
  isDark: boolean,
  pluginWrapper?: HTMLElement | null,
  overrides?: Partial<ThemeColorVariables> | null,
): void {
  if (typeof window === "undefined") return;

  const variables = getThemeVariables(themeId, isDark);
  if (!variables) return;
  const effectiveVariables = overrides
    ? ({ ...variables, ...overrides } satisfies Partial<ThemeColorVariables>)
    : variables;

  const root = document.documentElement;

  // Apply each variable to :root with inline style (highest specificity)
  Object.entries(effectiveVariables).forEach(([key, value]) => {
    if (value !== undefined) {
      root.style.setProperty(key, value);
    }
  });

  // CRITICAL: Also apply variables directly to plugin wrapper element
  // This ensures CSS variables are available inside the plugin even if
  // WordPress admin CSS has higher specificity on :root
  if (pluginWrapper) {
    Object.entries(effectiveVariables).forEach(([key, value]) => {
      if (value !== undefined) {
        pluginWrapper.style.setProperty(key, value);
      }
    });

    // Apply direct background and color styles for immediate visual feedback
    pluginWrapper.style.backgroundColor = effectiveVariables["--background"];
    pluginWrapper.style.color = effectiveVariables["--foreground"];
  }

  // Also apply Tailwind color variables for components using hardcoded Tailwind colors
  // This ensures classes like bg-white, bg-gray-100, etc. pick up theme colors
  applyTailwindColorOverrides(effectiveVariables, isDark);
}

/**
 * Apply Tailwind CSS color variable overrides
 * This maps hardcoded Tailwind color classes AND ShadCN semantic classes to theme variables
 *
 * CRITICAL: Tailwind CSS 4 compiles both utility classes AND semantic classes to static OKLCH values.
 * This means classes like `bg-background`, `bg-card`, `text-foreground` etc. are compiled to
 * static color values and do NOT use CSS variable references at runtime.
 *
 * We must inject CSS with !important that uses the actual theme color values directly.
 */
function applyTailwindColorOverrides(
  variables: ThemeColorVariables,
  _isDark: boolean,
): void {
  // Remove any existing style override element
  const existingStyle = document.getElementById("pm-theme-overrides");
  if (existingStyle) {
    existingStyle.remove();
  }

  // Create a new style element with high-specificity overrides
  const styleEl = document.createElement("style");
  styleEl.id = "pm-theme-overrides";

  // Build CSS with direct color values from theme variables
  // Using the actual OKLCH values for maximum compatibility
  // The #pressedmail-plugin selector provides specificity over compiled Tailwind
  const css = `
    /* ============================================= */
    /* PressedMail Theme Color Overrides - Generated */
    /* ============================================= */

    /* ============================================= */
    /* SHADCN SEMANTIC CLASSES - CRITICAL           */
    /* These are the primary classes used in the UI */
    /* ============================================= */

    /* Background colors */
    #pressedmail-plugin .bg-background,
    #pressedmail-plugin-frontend .bg-background,
    #pressedmail-plugin [class*="bg-background"],
    #pressedmail-plugin-frontend [class*="bg-background"] {
      background-color: ${variables["--background"]} !important;
    }

    #pressedmail-plugin .bg-card,
    #pressedmail-plugin-frontend .bg-card {
      background-color: ${variables["--card"]} !important;
    }

    #pressedmail-plugin .bg-popover,
    #pressedmail-plugin-frontend .bg-popover {
      background-color: ${variables["--popover"]} !important;
    }

    #pressedmail-plugin .bg-muted,
    #pressedmail-plugin-frontend .bg-muted {
      background-color: ${variables["--muted"]} !important;
    }

    #pressedmail-plugin .bg-muted\\/50,
    #pressedmail-plugin-frontend .bg-muted\\/50 {
      background-color: color-mix(in oklch, ${variables["--muted"]} 50%, transparent) !important;
    }

    #pressedmail-plugin .bg-muted\\/40,
    #pressedmail-plugin-frontend .bg-muted\\/40 {
      background-color: color-mix(in oklch, ${variables["--muted"]} 40%, transparent) !important;
    }

    #pressedmail-plugin .bg-muted\\/60,
    #pressedmail-plugin-frontend .bg-muted\\/60 {
      background-color: color-mix(in oklch, ${variables["--muted"]} 60%, transparent) !important;
    }

    #pressedmail-plugin .bg-muted\\/30,
    #pressedmail-plugin-frontend .bg-muted\\/30 {
      background-color: color-mix(in oklch, ${variables["--muted"]} 30%, transparent) !important;
    }

    #pressedmail-plugin .bg-accent,
    #pressedmail-plugin-frontend .bg-accent {
      background-color: ${variables["--accent"]} !important;
    }

    #pressedmail-plugin .bg-accent\\/50,
    #pressedmail-plugin-frontend .bg-accent\\/50 {
      background-color: color-mix(in oklch, ${variables["--accent"]} 50%, transparent) !important;
    }

    #pressedmail-plugin .bg-primary,
    #pressedmail-plugin-frontend .bg-primary {
      background-color: ${variables["--primary"]} !important;
    }

    #pressedmail-plugin .bg-primary\\/5,
    #pressedmail-plugin-frontend .bg-primary\\/5 {
      background-color: color-mix(in oklch, ${variables["--primary"]} 5%, transparent) !important;
    }

    #pressedmail-plugin .bg-primary\\/10,
    #pressedmail-plugin-frontend .bg-primary\\/10 {
      background-color: color-mix(in oklch, ${variables["--primary"]} 10%, transparent) !important;
    }

    #pressedmail-plugin .bg-primary\\/20,
    #pressedmail-plugin-frontend .bg-primary\\/20 {
      background-color: color-mix(in oklch, ${variables["--primary"]} 20%, transparent) !important;
    }

    #pressedmail-plugin .bg-primary\\/90,
    #pressedmail-plugin-frontend .bg-primary\\/90 {
      background-color: color-mix(in oklch, ${variables["--primary"]} 90%, transparent) !important;
    }

    #pressedmail-plugin .bg-secondary,
    #pressedmail-plugin-frontend .bg-secondary {
      background-color: ${variables["--secondary"]} !important;
    }

    #pressedmail-plugin .bg-destructive,
    #pressedmail-plugin-frontend .bg-destructive {
      background-color: ${variables["--destructive"]} !important;
    }

    #pressedmail-plugin .bg-success,
    #pressedmail-plugin-frontend .bg-success {
      background-color: ${variables["--success"]} !important;
    }

    #pressedmail-plugin .bg-warning,
    #pressedmail-plugin-frontend .bg-warning {
      background-color: ${variables["--warning"]} !important;
    }

    #pressedmail-plugin .bg-info,
    #pressedmail-plugin-frontend .bg-info {
      background-color: ${variables["--info"]} !important;
    }

    /* Text/Foreground colors */
    #pressedmail-plugin .text-foreground,
    #pressedmail-plugin-frontend .text-foreground {
      color: ${variables["--foreground"]} !important;
    }

    #pressedmail-plugin .text-card-foreground,
    #pressedmail-plugin-frontend .text-card-foreground {
      color: ${variables["--card-foreground"]} !important;
    }

    #pressedmail-plugin .text-popover-foreground,
    #pressedmail-plugin-frontend .text-popover-foreground {
      color: ${variables["--popover-foreground"]} !important;
    }

    #pressedmail-plugin .text-muted-foreground,
    #pressedmail-plugin-frontend .text-muted-foreground {
      color: ${variables["--muted-foreground"]} !important;
    }

    #pressedmail-plugin .placeholder\\:text-muted-foreground::placeholder,
    #pressedmail-plugin-frontend .placeholder\\:text-muted-foreground::placeholder {
      color: ${variables["--muted-foreground"]} !important;
    }

    #pressedmail-plugin .text-accent-foreground,
    #pressedmail-plugin-frontend .text-accent-foreground {
      color: ${variables["--accent-foreground"]} !important;
    }

    #pressedmail-plugin .text-primary,
    #pressedmail-plugin-frontend .text-primary {
      color: ${variables["--primary"]} !important;
    }

    #pressedmail-plugin .text-primary-foreground,
    #pressedmail-plugin-frontend .text-primary-foreground {
      color: ${variables["--primary-foreground"]} !important;
    }

    #pressedmail-plugin .text-secondary-foreground,
    #pressedmail-plugin-frontend .text-secondary-foreground {
      color: ${variables["--secondary-foreground"]} !important;
    }

    #pressedmail-plugin .text-destructive,
    #pressedmail-plugin-frontend .text-destructive {
      color: ${variables["--destructive"]} !important;
    }

    #pressedmail-plugin .text-destructive-foreground,
    #pressedmail-plugin-frontend .text-destructive-foreground {
      color: ${variables["--destructive-foreground"]} !important;
    }

    #pressedmail-plugin .text-success,
    #pressedmail-plugin-frontend .text-success {
      color: ${variables["--success"]} !important;
    }

    #pressedmail-plugin .text-success-foreground,
    #pressedmail-plugin-frontend .text-success-foreground {
      color: ${variables["--success-foreground"]} !important;
    }

    #pressedmail-plugin .text-warning,
    #pressedmail-plugin-frontend .text-warning {
      color: ${variables["--warning"]} !important;
    }

    #pressedmail-plugin .text-warning-foreground,
    #pressedmail-plugin-frontend .text-warning-foreground {
      color: ${variables["--warning-foreground"]} !important;
    }

    #pressedmail-plugin .text-info,
    #pressedmail-plugin-frontend .text-info {
      color: ${variables["--info"]} !important;
    }

    #pressedmail-plugin .text-info-foreground,
    #pressedmail-plugin-frontend .text-info-foreground {
      color: ${variables["--info-foreground"]} !important;
    }

    /* Border colors */
    #pressedmail-plugin .border-border,
    #pressedmail-plugin-frontend .border-border {
      border-color: ${variables["--border"]} !important;
    }

    #pressedmail-plugin .border-input,
    #pressedmail-plugin-frontend .border-input {
      border-color: ${variables["--input"]} !important;
    }

    #pressedmail-plugin .border-input\\/50,
    #pressedmail-plugin-frontend .border-input\\/50 {
      border-color: color-mix(in oklch, ${variables["--input"]} 50%, transparent) !important;
    }

    #pressedmail-plugin .border-primary,
    #pressedmail-plugin-frontend .border-primary {
      border-color: ${variables["--primary"]} !important;
    }

    #pressedmail-plugin .border-primary\\/20,
    #pressedmail-plugin-frontend .border-primary\\/20 {
      border-color: color-mix(in oklch, ${variables["--primary"]} 20%, transparent) !important;
    }

    #pressedmail-plugin .border-primary\\/50,
    #pressedmail-plugin-frontend .border-primary\\/50 {
      border-color: color-mix(in oklch, ${variables["--primary"]} 50%, transparent) !important;
    }

    #pressedmail-plugin .border-destructive,
    #pressedmail-plugin-frontend .border-destructive {
      border-color: ${variables["--destructive"]} !important;
    }

    #pressedmail-plugin .border-success,
    #pressedmail-plugin-frontend .border-success {
      border-color: ${variables["--success-border"]} !important;
    }

    #pressedmail-plugin .border-warning,
    #pressedmail-plugin-frontend .border-warning {
      border-color: ${variables["--warning-border"]} !important;
    }

    #pressedmail-plugin .border-info,
    #pressedmail-plugin-frontend .border-info {
      border-color: ${variables["--info-border"]} !important;
    }

    #pressedmail-plugin .border-muted,
    #pressedmail-plugin-frontend .border-muted {
      border-color: ${variables["--muted"]} !important;
    }

    /* Input background (used by Kit UI Input component: dark:bg-input/30) */
    .dark #pressedmail-plugin .dark\\:bg-input\\/30,
    .dark #pressedmail-plugin-frontend .dark\\:bg-input\\/30 {
      background-color: color-mix(in oklch, ${variables["--input"]} 30%, transparent) !important;
    }

    /* ============================================= */
    /* CHECKBOX TOKENS                                */
    /* Shared Kit UI checkbox styling for plugin,     */
    /* frontend, and portaled dropdown/dialog content */
    /* in every palette and display mode.             */
    /* ============================================= */
    #pressedmail-plugin [data-slot="checkbox"]:not([data-checked]),
    #pressedmail-plugin-frontend [data-slot="checkbox"]:not([data-checked]),
    [data-pm-portal] [data-slot="checkbox"]:not([data-checked]) {
      border-color: ${variables["--checkbox-border"]} !important;
      background-color: ${variables["--checkbox-background"]} !important;
      outline: 1px solid color-mix(in oklch, ${variables["--checkbox-border"]} 65%, transparent);
      outline-offset: 1px;
    }

    #pressedmail-plugin [data-slot="checkbox"][data-checked],
    #pressedmail-plugin-frontend [data-slot="checkbox"][data-checked],
    [data-pm-portal] [data-slot="checkbox"][data-checked] {
      border-color: ${variables["--checkbox-checked-background"]} !important;
      background-color: ${variables["--checkbox-checked-background"]} !important;
      color: ${variables["--checkbox-checked-foreground"]} !important;
      outline: 1px solid color-mix(in oklch, ${variables["--checkbox-checked-background"]} 45%, transparent);
      outline-offset: 1px;
    }

    #pressedmail-plugin [data-slot="checkbox"][data-checked] [data-slot="checkbox-indicator"],
    #pressedmail-plugin-frontend [data-slot="checkbox"][data-checked] [data-slot="checkbox-indicator"],
    [data-pm-portal] [data-slot="checkbox"][data-checked] [data-slot="checkbox-indicator"] {
      color: ${variables["--checkbox-checked-foreground"]} !important;
    }

    /* Ring colors */
    #pressedmail-plugin .ring-ring,
    #pressedmail-plugin-frontend .ring-ring {
      --tw-ring-color: ${variables["--ring"]} !important;
    }

    #pressedmail-plugin .ring-primary,
    #pressedmail-plugin-frontend .ring-primary {
      --tw-ring-color: ${variables["--primary"]} !important;
    }

    #pressedmail-plugin .ring-offset-background,
    #pressedmail-plugin-frontend .ring-offset-background {
      --tw-ring-offset-color: ${variables["--background"]} !important;
    }

    #pressedmail-plugin .focus-visible\\:border-ring:focus-visible,
    #pressedmail-plugin-frontend .focus-visible\\:border-ring:focus-visible {
      border-color: ${variables["--ring"]} !important;
    }

    #pressedmail-plugin .focus-visible\\:ring-ring\\/50:focus-visible,
    #pressedmail-plugin-frontend .focus-visible\\:ring-ring\\/50:focus-visible {
      --tw-ring-color: color-mix(in oklch, ${variables["--ring"]} 50%, transparent) !important;
    }

    #pressedmail-plugin .focus-visible\\:ring-ring:focus-visible,
    #pressedmail-plugin-frontend .focus-visible\\:ring-ring:focus-visible {
      --tw-ring-color: ${variables["--ring"]} !important;
    }

    /* Divide colors */
    #pressedmail-plugin .divide-border > :not([hidden]) ~ :not([hidden]),
    #pressedmail-plugin-frontend .divide-border > :not([hidden]) ~ :not([hidden]) {
      border-color: ${variables["--border"]} !important;
    }

    /* Hover states for ShadCN classes */
    #pressedmail-plugin .hover\\:bg-accent:hover,
    #pressedmail-plugin-frontend .hover\\:bg-accent:hover {
      background-color: ${variables["--accent"]} !important;
    }

    #pressedmail-plugin .hover\\:bg-accent\\/50:hover,
    #pressedmail-plugin-frontend .hover\\:bg-accent\\/50:hover {
      background-color: color-mix(in oklch, ${variables["--accent"]} 50%, transparent) !important;
    }

    #pressedmail-plugin .hover\\:bg-muted:hover,
    #pressedmail-plugin-frontend .hover\\:bg-muted:hover {
      background-color: ${variables["--muted"]} !important;
    }

    #pressedmail-plugin .hover\\:bg-muted\\/50:hover,
    #pressedmail-plugin-frontend .hover\\:bg-muted\\/50:hover {
      background-color: color-mix(in oklch, ${variables["--muted"]} 50%, transparent) !important;
    }

    #pressedmail-plugin .hover\\:bg-primary:hover,
    #pressedmail-plugin-frontend .hover\\:bg-primary:hover {
      background-color: ${variables["--primary"]} !important;
    }

    #pressedmail-plugin .hover\\:bg-primary\\/90:hover,
    #pressedmail-plugin-frontend .hover\\:bg-primary\\/90:hover {
      background-color: color-mix(in oklch, ${variables["--primary"]} 90%, ${variables["--background"]}) !important;
    }

    #pressedmail-plugin .hover\\:bg-primary\\/10:hover,
    #pressedmail-plugin-frontend .hover\\:bg-primary\\/10:hover {
      background-color: color-mix(in oklch, ${variables["--primary"]} 10%, transparent) !important;
    }

    #pressedmail-plugin .hover\\:bg-secondary:hover,
    #pressedmail-plugin-frontend .hover\\:bg-secondary:hover {
      background-color: ${variables["--secondary"]} !important;
    }

    #pressedmail-plugin .hover\\:bg-background:hover,
    #pressedmail-plugin-frontend .hover\\:bg-background:hover {
      background-color: ${variables["--background"]} !important;
    }

    #pressedmail-plugin .hover\\:text-foreground:hover,
    #pressedmail-plugin-frontend .hover\\:text-foreground:hover {
      color: ${variables["--foreground"]} !important;
    }

    #pressedmail-plugin .hover\\:text-accent-foreground:hover,
    #pressedmail-plugin-frontend .hover\\:text-accent-foreground:hover {
      color: ${variables["--accent-foreground"]} !important;
    }

    #pressedmail-plugin .hover\\:text-primary:hover,
    #pressedmail-plugin-frontend .hover\\:text-primary:hover {
      color: ${variables["--primary"]} !important;
    }

    #pressedmail-plugin .hover\\:border-primary:hover,
    #pressedmail-plugin-frontend .hover\\:border-primary:hover {
      border-color: ${variables["--primary"]} !important;
    }

    #pressedmail-plugin .hover\\:border-primary\\/50:hover,
    #pressedmail-plugin-frontend .hover\\:border-primary\\/50:hover {
      border-color: color-mix(in oklch, ${variables["--primary"]} 50%, transparent) !important;
    }

    /* Focus states for ShadCN classes */
    #pressedmail-plugin .focus\\:bg-accent:focus,
    #pressedmail-plugin-frontend .focus\\:bg-accent:focus {
      background-color: ${variables["--accent"]} !important;
    }

    #pressedmail-plugin .focus\\:text-accent-foreground:focus,
    #pressedmail-plugin-frontend .focus\\:text-accent-foreground:focus {
      color: ${variables["--accent-foreground"]} !important;
    }

    #pressedmail-plugin .focus\\:bg-background:focus,
    #pressedmail-plugin-frontend .focus\\:bg-background:focus {
      background-color: ${variables["--background"]} !important;
    }

    /* Focus-within states for containers (search bars, etc.) */
    #pressedmail-plugin .focus-within\\:bg-background:focus-within,
    #pressedmail-plugin-frontend .focus-within\\:bg-background:focus-within {
      background-color: ${variables["--background"]} !important;
    }

    #pressedmail-plugin .focus-within\\:ring-ring:focus-within,
    #pressedmail-plugin-frontend .focus-within\\:ring-ring:focus-within {
      --tw-ring-color: ${variables["--ring"]} !important;
    }

    #pressedmail-plugin .focus-within\\:border-input:focus-within,
    #pressedmail-plugin-frontend .focus-within\\:border-input:focus-within {
      border-color: ${variables["--input"]} !important;
    }

    /* Data state active (for Tabs, etc.) */
    #pressedmail-plugin .data-\\[state\\=active\\]\\:bg-background[data-state="active"],
    #pressedmail-plugin-frontend .data-\\[state\\=active\\]\\:bg-background[data-state="active"] {
      background-color: ${variables["--background"]} !important;
    }

    #pressedmail-plugin .data-\\[state\\=active\\]\\:text-foreground[data-state="active"],
    #pressedmail-plugin-frontend .data-\\[state\\=active\\]\\:text-foreground[data-state="active"] {
      color: ${variables["--foreground"]} !important;
    }

    /* Group hover states */
    #pressedmail-plugin .group:hover .group-hover\\:text-foreground,
    #pressedmail-plugin-frontend .group:hover .group-hover\\:text-foreground {
      color: ${variables["--foreground"]} !important;
    }

    /* Background with backdrop-blur support */
    #pressedmail-plugin .bg-background\\/95,
    #pressedmail-plugin-frontend .bg-background\\/95 {
      background-color: color-mix(in oklch, ${variables["--background"]} 95%, transparent) !important;
    }

    #pressedmail-plugin .bg-background\\/80,
    #pressedmail-plugin-frontend .bg-background\\/80 {
      background-color: color-mix(in oklch, ${variables["--background"]} 80%, transparent) !important;
    }

    #pressedmail-plugin .bg-background\\/75,
    #pressedmail-plugin-frontend .bg-background\\/75 {
      background-color: color-mix(in oklch, ${variables["--background"]} 75%, transparent) !important;
    }

    #pressedmail-plugin .bg-background\\/60,
    #pressedmail-plugin-frontend .bg-background\\/60 {
      background-color: color-mix(in oklch, ${variables["--background"]} 60%, transparent) !important;
    }

    #pressedmail-plugin .bg-background\\/50,
    #pressedmail-plugin-frontend .bg-background\\/50 {
      background-color: color-mix(in oklch, ${variables["--background"]} 50%, transparent) !important;
    }

    #pressedmail-plugin .bg-card\\/80,
    #pressedmail-plugin-frontend .bg-card\\/80 {
      background-color: color-mix(in oklch, ${variables["--card"]} 80%, transparent) !important;
    }

    /* Sidebar colors (if defined) */
    ${
      variables["--sidebar-background"]
        ? `
    #pressedmail-plugin .bg-sidebar,
    #pressedmail-plugin-frontend .bg-sidebar {
      background-color: ${variables["--sidebar-background"]} !important;
    }
    `
        : ""
    }

    ${
      variables["--sidebar-foreground"]
        ? `
    #pressedmail-plugin .text-sidebar-foreground,
    #pressedmail-plugin-frontend .text-sidebar-foreground {
      color: ${variables["--sidebar-foreground"]} !important;
    }
    `
        : ""
    }

    ${
      variables["--sidebar-border"]
        ? `
    #pressedmail-plugin .border-sidebar,
    #pressedmail-plugin-frontend .border-sidebar {
      border-color: ${variables["--sidebar-border"]} !important;
    }
    `
        : ""
    }

    /* ============================================= */
    /* GENERIC TAILWIND CLASSES - FALLBACK          */
    /* For any remaining hardcoded color classes    */
    /* ============================================= */

    /* White backgrounds */
    #pressedmail-plugin .bg-white,
    #pressedmail-plugin-frontend .bg-white {
      background-color: ${variables["--background"]} !important;
    }

    /* Gray scale backgrounds */
    #pressedmail-plugin .bg-gray-50,
    #pressedmail-plugin-frontend .bg-gray-50,
    #pressedmail-plugin .bg-slate-50,
    #pressedmail-plugin-frontend .bg-slate-50,
    #pressedmail-plugin .bg-zinc-50,
    #pressedmail-plugin-frontend .bg-zinc-50,
    #pressedmail-plugin .bg-stone-50,
    #pressedmail-plugin-frontend .bg-stone-50 {
      background-color: ${variables["--card"]} !important;
    }

    #pressedmail-plugin .bg-gray-100,
    #pressedmail-plugin-frontend .bg-gray-100,
    #pressedmail-plugin .bg-slate-100,
    #pressedmail-plugin-frontend .bg-slate-100,
    #pressedmail-plugin .bg-zinc-100,
    #pressedmail-plugin-frontend .bg-zinc-100 {
      background-color: ${variables["--muted"]} !important;
    }

    #pressedmail-plugin .bg-gray-200,
    #pressedmail-plugin-frontend .bg-gray-200,
    #pressedmail-plugin .bg-slate-200,
    #pressedmail-plugin-frontend .bg-slate-200 {
      background-color: ${variables["--accent"]} !important;
    }

    #pressedmail-plugin .bg-gray-800,
    #pressedmail-plugin-frontend .bg-gray-800,
    #pressedmail-plugin .bg-slate-800,
    #pressedmail-plugin-frontend .bg-slate-800 {
      background-color: ${variables["--secondary"]} !important;
    }

    #pressedmail-plugin .bg-gray-900,
    #pressedmail-plugin-frontend .bg-gray-900,
    #pressedmail-plugin .bg-slate-900,
    #pressedmail-plugin-frontend .bg-slate-900 {
      background-color: ${variables["--background"]} !important;
    }

    /* Primary colors - Blue -> Primary */
    #pressedmail-plugin .bg-blue-600,
    #pressedmail-plugin-frontend .bg-blue-600,
    #pressedmail-plugin .bg-blue-500,
    #pressedmail-plugin-frontend .bg-blue-500 {
      background-color: ${variables["--primary"]} !important;
    }

    #pressedmail-plugin .bg-blue-50,
    #pressedmail-plugin-frontend .bg-blue-50,
    #pressedmail-plugin .bg-blue-100,
    #pressedmail-plugin-frontend .bg-blue-100 {
      background-color: color-mix(in oklch, ${variables["--primary"]} 15%, ${variables["--background"]}) !important;
    }

    #pressedmail-plugin .text-blue-600,
    #pressedmail-plugin-frontend .text-blue-600,
    #pressedmail-plugin .text-blue-700,
    #pressedmail-plugin-frontend .text-blue-700,
    #pressedmail-plugin .text-blue-500,
    #pressedmail-plugin-frontend .text-blue-500 {
      color: ${variables["--primary"]} !important;
    }

    /* Text colors - Gray scale */
    #pressedmail-plugin .text-gray-900,
    #pressedmail-plugin-frontend .text-gray-900,
    #pressedmail-plugin .text-gray-800,
    #pressedmail-plugin-frontend .text-gray-800,
    #pressedmail-plugin .text-gray-700,
    #pressedmail-plugin-frontend .text-gray-700 {
      color: ${variables["--foreground"]} !important;
    }

    #pressedmail-plugin .text-gray-600,
    #pressedmail-plugin-frontend .text-gray-600,
    #pressedmail-plugin .text-gray-500,
    #pressedmail-plugin-frontend .text-gray-500,
    #pressedmail-plugin .text-gray-400,
    #pressedmail-plugin-frontend .text-gray-400 {
      color: ${variables["--muted-foreground"]} !important;
    }

    /* Border colors - Gray scale */
    #pressedmail-plugin .border-gray-200,
    #pressedmail-plugin-frontend .border-gray-200,
    #pressedmail-plugin .border-gray-300,
    #pressedmail-plugin-frontend .border-gray-300,
    #pressedmail-plugin .border-gray-100,
    #pressedmail-plugin-frontend .border-gray-100 {
      border-color: ${variables["--border"]} !important;
    }

    /* Divide colors */
    #pressedmail-plugin .divide-gray-200 > :not([hidden]) ~ :not([hidden]),
    #pressedmail-plugin-frontend .divide-gray-200 > :not([hidden]) ~ :not([hidden]) {
      border-color: ${variables["--border"]} !important;
    }

    /* Focus ring */
    #pressedmail-plugin .ring-blue-500,
    #pressedmail-plugin-frontend .ring-blue-500,
    #pressedmail-plugin .focus\\:ring-blue-500:focus,
    #pressedmail-plugin-frontend .focus\\:ring-blue-500:focus {
      --tw-ring-color: ${variables["--ring"]} !important;
    }

    /* Hover states for gray backgrounds */
    #pressedmail-plugin .hover\\:bg-gray-100:hover,
    #pressedmail-plugin-frontend .hover\\:bg-gray-100:hover,
    #pressedmail-plugin .hover\\:bg-gray-50:hover,
    #pressedmail-plugin-frontend .hover\\:bg-gray-50:hover {
      background-color: ${variables["--accent"]} !important;
    }

    #pressedmail-plugin .hover\\:bg-blue-700:hover,
    #pressedmail-plugin-frontend .hover\\:bg-blue-700:hover,
    #pressedmail-plugin .hover\\:bg-blue-600:hover,
    #pressedmail-plugin-frontend .hover\\:bg-blue-600:hover {
      background-color: color-mix(in oklch, ${variables["--primary"]} 85%, black) !important;
    }

    /* Destructive/Red colors */
    #pressedmail-plugin .bg-red-600,
    #pressedmail-plugin-frontend .bg-red-600,
    #pressedmail-plugin .bg-red-500,
    #pressedmail-plugin-frontend .bg-red-500 {
      background-color: ${variables["--destructive"]} !important;
    }

    #pressedmail-plugin .text-red-600,
    #pressedmail-plugin-frontend .text-red-600,
    #pressedmail-plugin .text-red-500,
    #pressedmail-plugin-frontend .text-red-500 {
      color: ${variables["--destructive"]} !important;
    }

    #pressedmail-plugin .bg-red-50,
    #pressedmail-plugin-frontend .bg-red-50,
    #pressedmail-plugin .bg-red-100,
    #pressedmail-plugin-frontend .bg-red-100 {
      background-color: color-mix(in oklch, ${variables["--destructive"]} 12%, ${variables["--background"]}) !important;
    }

    /* Purple/Indigo accent colors */
    #pressedmail-plugin .bg-purple-600,
    #pressedmail-plugin-frontend .bg-purple-600,
    #pressedmail-plugin .bg-purple-500,
    #pressedmail-plugin-frontend .bg-purple-500,
    #pressedmail-plugin .bg-indigo-600,
    #pressedmail-plugin-frontend .bg-indigo-600 {
      background-color: ${variables["--primary"]} !important;
    }

    #pressedmail-plugin .text-purple-600,
    #pressedmail-plugin-frontend .text-purple-600,
    #pressedmail-plugin .text-indigo-600,
    #pressedmail-plugin-frontend .text-indigo-600 {
      color: ${variables["--primary"]} !important;
    }

    /* Sky colors (used in some layouts) */
    #pressedmail-plugin .bg-sky-50,
    #pressedmail-plugin-frontend .bg-sky-50 {
      background-color: color-mix(in oklch, ${variables["--primary"]} 10%, ${variables["--background"]}) !important;
    }

    #pressedmail-plugin .bg-sky-950\\/30,
    #pressedmail-plugin-frontend .bg-sky-950\\/30 {
      background-color: color-mix(in oklch, ${variables["--primary"]} 30%, ${variables["--background"]}) !important;
    }

    /* ============================================= */
    /* ROOT ELEMENT OVERRIDE                        */
    /* Apply theme to the main plugin container     */
    /* ============================================= */

    #pressedmail-plugin,
    #pressedmail-plugin-frontend {
      background-color: ${variables["--background"]} !important;
      color: ${variables["--foreground"]} !important;
    }
  `;

  // Extend all selectors to also target portal content.
  // Radix Dialog/Popover/Select portals render outside #pressedmail-plugin on
  // document.body. The plugin UI components wrap portal content in a div with
  // [data-pm-portal] attribute for theme scoping.
  //
  // Strategy: match every "#pressedmail-plugin-frontend <selector>" occurrence
  // (whether followed by , or {) and append a [data-pm-portal] duplicate.
  const shortcodeCss = css
    .split("#pressedmail-plugin-frontend")
    .join(".pressedmail-frontend");
  const portalCss = `${css}\n${shortcodeCss}`.replace(
    /#pressedmail-plugin-frontend\s+([^{,\n]+)/g,
    (match, selector) => `${match},\n    [data-pm-portal] ${selector.trim()}`,
  );

  styleEl.textContent = portalCss;

  // Append to head for highest priority
  document.head.appendChild(styleEl);
}

/**
 * Clear all theme variables from document root
 */
export function clearThemeVariables(): void {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  const theme = THEME_REGISTRY.pressedm;
  if (!theme) return;

  // Clear all theme variables
  const allKeys = new Set([
    ...Object.keys(theme.light),
    ...Object.keys(theme.dark),
  ]);

  allKeys.forEach((key) => {
    root.style.removeProperty(key);
  });
}
