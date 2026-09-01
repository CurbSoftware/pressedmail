/** Product-neutral, explicitly scoped font CSS generation. */
import { removeStyleElement, replaceStyleElement } from '../css/style-manager';
import type { FontConfig } from '../types/fonts';

export interface FontCssOptions {
  scopeSelectors: readonly string[];
  styleElementId?: string;
}

const DEFAULT_FONT_STYLE_ID = 'kit-theme-font-config';

function normalizeSelectors(selectors: readonly string[]): string[] {
  const normalized = [
    ...new Set(selectors.map((selector) => selector.trim())),
  ].filter(Boolean);
  if (normalized.length === 0) {
    throw new Error('At least one appearance scope selector is required.');
  }
  return normalized;
}

export function generateFontCss(
  config: FontConfig,
  options: FontCssOptions,
): string {
  const selectors = normalizeSelectors(options.scopeSelectors);
  const roots = selectors.join(',\n');
  const displaySelectors = selectors
    .flatMap((selector) => [
      `${selector} h1`,
      `${selector} h2`,
      `${selector} h3`,
      `${selector} h4`,
      `${selector} h5`,
      `${selector} h6`,
      `${selector} [data-appearance-display-font]`,
    ])
    .join(',\n');

  return `/* Font configuration: generated for explicit appearance scopes. */
${roots} {
  --theme-display-family: ${config.display.family};
  --theme-display-weight: ${config.display.weight};
  --theme-text-family: ${config.text.family};
  --theme-text-weight: ${config.text.weight};
  font-family: var(--theme-text-family);
  font-weight: var(--theme-text-weight);
}

${displaySelectors} {
  font-family: var(--theme-display-family) !important;
  font-weight: var(--theme-display-weight) !important;
}`;
}

export function applyFontCss(
  config: FontConfig,
  options: FontCssOptions,
): () => void {
  const styleElementId = options.styleElementId ?? DEFAULT_FONT_STYLE_ID;
  return replaceStyleElement(styleElementId, generateFontCss(config, options));
}

export function clearFontCss(styleElementId = DEFAULT_FONT_STYLE_ID): void {
  removeStyleElement(styleElementId);
}
