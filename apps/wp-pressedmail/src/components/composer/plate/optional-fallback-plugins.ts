import { createSlatePlugin, KEYS } from '@kit/plate';

/**
 * Lightweight compatibility nodes for content created before optional Plate
 * feature stacks were split out of the default PressedMail composer bundle.
 *
 * These preserve rendering/serialization for existing equation and drawing
 * values without importing the heavy math, Excalidraw, Markdown, or Docx kits.
 */
export const ComposerEquationFallbackPlugin = createSlatePlugin({
  key: KEYS.equation,
  node: { isElement: true, isVoid: true },
});

export const ComposerInlineEquationFallbackPlugin = createSlatePlugin({
  key: KEYS.inlineEquation,
  node: { isElement: true, isInline: true, isVoid: true },
});

export const ComposerDrawingFallbackPlugin = createSlatePlugin({
  key: KEYS.excalidraw,
  node: { isElement: true, isVoid: true },
});
