/**
 * Dual font system types.
 *
 * Inspired by StyleGlide's display/text font separation:
 * - Display font: headings, nav labels, emphasis
 * - Text font: body, email content, forms
 */

/**
 * A single font selection with family and weight.
 */
export interface FontSelection {
  /** CSS font-family value, e.g. '"Inter", sans-serif' */
  family: string;
  /** CSS font-weight, e.g. "600" */
  weight: string;
  /** Font file name (without extension) for bundled woff2 loading */
  fontFileName?: string;
  /** Whether this is a system font stack (no loading needed) */
  isSystem?: boolean;
}

/**
 * Dual font configuration (display + text).
 */
export interface FontConfig {
  /** Font for headings, nav labels, emphasis text */
  display: FontSelection;
  /** Font for body text, email content, form inputs */
  text: FontSelection;
}

/**
 * Font preset category for filtering.
 */
export type FontPresetCategory =
  | 'system'
  | 'sans-serif'
  | 'serif'
  | 'monospace'
  | 'mixed';

/**
 * A curated font pairing preset.
 */
export interface FontPreset {
  /** Unique preset identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short description of the pairing */
  description: string;
  /** Category for filtering */
  category: FontPresetCategory;
  /** Display font configuration */
  display: FontSelection;
  /** Text font configuration */
  text: FontSelection;
}

/** A product-supplied semantic font option for application appearance. */
export interface SemanticFontDefinition {
  id: string;
  name: string;
  family: string;
  description?: string;
  category?: FontPresetCategory | 'accessibility';
  isAccessibilityFont?: boolean;
}

export type SemanticFontSizeId = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** A semantic base-size option shared by typography controls and runtime CSS. */
export interface SemanticFontSizeDefinition {
  id: SemanticFontSizeId;
  name: string;
  pixels: 16 | 18 | 20 | 22 | 24;
  value: `${number}px`;
}

/** Product-neutral semantic size scale. Labels may be adapted by consumers. */
export const SEMANTIC_FONT_SIZES: readonly SemanticFontSizeDefinition[] = [
  { id: 'xs', name: 'Extra Small', pixels: 16, value: '16px' },
  { id: 'sm', name: 'Small', pixels: 18, value: '18px' },
  { id: 'md', name: 'Medium', pixels: 20, value: '20px' },
  { id: 'lg', name: 'Large', pixels: 22, value: '22px' },
  { id: 'xl', name: 'Extra Large', pixels: 24, value: '24px' },
] as const;
