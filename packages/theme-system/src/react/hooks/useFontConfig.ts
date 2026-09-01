import type { FontConfig, SemanticFontDefinition } from '../../types/fonts';
import { useTheme } from './useTheme';

export interface UseFontConfigResult {
  font: SemanticFontDefinition;
  fontConfig: FontConfig;
  fontId: string;
}

/** Typography is resolved from the injected catalog and applied by the provider. */
export function useFontConfig(): UseFontConfigResult {
  const { font, fontConfig } = useTheme();
  return { font, fontConfig, fontId: font.id };
}
