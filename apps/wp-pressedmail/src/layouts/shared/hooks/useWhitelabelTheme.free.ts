/**
 * Free-edition whitelabel theme: permanently disabled.
 *
 * Whitelabelling is an Ultimate feature. The real hook, its settings fetch and
 * its layout-locking rules were reaching the Free bundle through shared footer
 * and speed-dial chrome, gated only by a runtime flag.
 */
import type { UseWhitelabelThemeReturn } from "@/types/whitelabel";

const DISABLED: UseWhitelabelThemeReturn = {
  themeTokens: { light: {}, dark: {} },
  isWhitelabelEnabled: false,
  logo: null,
  logoLight: null,
  pluginName: "PressedMail",
  hidePoweredBy: false,
  squareMark: null,
  supportUrl: null,
  documentationUrl: null,
  areProPalettesDisabled: false,
  allowLayoutSwitching: true,
  allowThemeSwitching: true,
  allowModeSwitching: true,
  defaultLayout: "pressedm",
  defaultTheme: "pressedm",
  defaultMode: "system",
  getCSSVariables: () => ({}),
  getCSSVariablesString: () => "",
  applyCSSVariables: () => undefined,
};

export function useWhitelabelTheme(): UseWhitelabelThemeReturn {
  return DISABLED;
}

export default useWhitelabelTheme;
