import type { ThemeColorVariables } from "@/types/theme";
import type { EffectiveWhitelabelRuntime } from "@/types/whitelabel";

type BrandAppearance = EffectiveWhitelabelRuntime["appearance"];

export interface CompiledEditionBrandTheme {
  light: ThemeColorVariables;
  dark: ThemeColorVariables;
  baseThemeId: string;
}

export interface EditionBrandThemeOption {
  id: string;
  name: string;
  colors: {
    light: { primary: string; secondary: string; accent: string };
    dark: { primary: string; secondary: string; accent: string };
  };
}

export function compileEditionBrandTheme(
  _appearance: BrandAppearance | null | undefined,
): CompiledEditionBrandTheme | null {
  return null;
}

export function getEditionBrandThemeOption(
  _appearance: BrandAppearance | null | undefined,
): EditionBrandThemeOption | null {
  return null;
}
