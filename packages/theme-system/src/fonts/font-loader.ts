import { removeStyleElement, replaceStyleElement } from '../css/style-manager';

export interface FontAssetFace {
  fileName: string;
  weight: number | string;
  style?: 'normal' | 'italic' | 'oblique';
}

export interface FontAssetDefinition {
  family: string;
  faces: readonly FontAssetFace[];
}

export interface FontLoaderOptions {
  styleElementId?: string;
}

const DEFAULT_FONT_ASSET_STYLE_ID = 'kit-theme-font-assets';

/** Generate local @font-face rules from product-supplied asset metadata. */
export function generateFontFaceCss(
  definition: FontAssetDefinition,
  assetsUrl: string,
): string {
  const baseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`;
  return definition.faces
    .map(
      (face) => `@font-face {
  font-family: "${definition.family}";
  font-style: ${face.style ?? 'normal'};
  font-weight: ${face.weight};
  font-display: swap;
  src: url("${baseUrl}${face.fileName}") format("woff2");
}`,
    )
    .join('\n\n');
}

/** Load injected font assets and return a cleanup callback. */
export function loadFonts(
  definition: FontAssetDefinition,
  assetsUrl: string,
  options: FontLoaderOptions = {},
): () => void {
  const styleElementId = options.styleElementId ?? DEFAULT_FONT_ASSET_STYLE_ID;
  const css = generateFontFaceCss(definition, assetsUrl);
  if (!css) return () => {};
  return replaceStyleElement(styleElementId, css);
}

export function unloadFonts(
  styleElementId = DEFAULT_FONT_ASSET_STYLE_ID,
): void {
  removeStyleElement(styleElementId);
}
