export const PLATE_EMAIL_EDITOR_SURFACES = [
  'email',
  'signature',
  'auto_reply',
  'content_block',
] as const;

export type PlateEmailEditorSurface =
  (typeof PLATE_EMAIL_EDITOR_SURFACES)[number];

export type PlateEmailEditorFeature =
  | 'formatting'
  | 'links'
  | 'inlineMedia'
  | 'mediaLibrary'
  | 'localImageUpload'
  | 'aiCommands'
  | 'signatures'
  | 'contentBlocks'
  | 'preview';

export type PlateEmailEditorFeatureFlags = Readonly<
  Record<PlateEmailEditorFeature, boolean>
>;

export type PlateEmailEditorFeatureOverrides = Partial<
  Record<PlateEmailEditorFeature, boolean>
>;

export interface PlateEmailEditorSurfacePreset {
  readonly surface: PlateEmailEditorSurface;
  readonly featureSet:
    | 'email-compose'
    | 'identity-content'
    | 'email-automation'
    | 'reusable-content';
  readonly className: string;
  readonly defaultMinHeight: number;
  /**
   * What the canvas looks like while the author is editing.
   *
   * `app-theme` follows the app's light or dark UI theme and draws its own
   * boundary. A message body is transient text on the app's own surface, so it
   * is written on one.
   *
   * `email-canvas` keeps the fixed light email palette and draws no boundary of
   * its own, because the surrounding card already draws one. A signature or an
   * auto-reply is content destined for a white email, so it is written while
   * looking like one. Toggling Preview moves every surface to the email canvas
   * either way, so the two only differ before the author asks to see the result.
   */
  readonly editingCanvas: 'app-theme' | 'email-canvas';
  readonly features: PlateEmailEditorFeatureFlags;
}

const baseAuthoringFeatures: PlateEmailEditorFeatureFlags = {
  formatting: true,
  links: true,
  inlineMedia: true,
  mediaLibrary: true,
  localImageUpload: true,
  aiCommands: true,
  signatures: false,
  contentBlocks: true,
  preview: true,
};

export const PLATE_EMAIL_EDITOR_SURFACE_PRESETS = {
  email: {
    surface: 'email',
    featureSet: 'email-compose',
    className: 'pm-plate-email-surface',
    defaultMinHeight: 200,
    editingCanvas: 'app-theme',
    features: {
      ...baseAuthoringFeatures,
      signatures: true,
    },
  },
  signature: {
    surface: 'signature',
    featureSet: 'identity-content',
    className: 'pm-plate-signature-surface',
    defaultMinHeight: 260,
    editingCanvas: 'email-canvas',
    features: baseAuthoringFeatures,
  },
  auto_reply: {
    surface: 'auto_reply',
    featureSet: 'email-automation',
    className: 'pm-plate-auto-reply-surface',
    defaultMinHeight: 260,
    editingCanvas: 'email-canvas',
    features: baseAuthoringFeatures,
  },
  content_block: {
    surface: 'content_block',
    featureSet: 'reusable-content',
    className: 'pm-plate-content-block-surface',
    defaultMinHeight: 260,
    editingCanvas: 'email-canvas',
    features: baseAuthoringFeatures,
  },
} as const satisfies Record<
  PlateEmailEditorSurface,
  PlateEmailEditorSurfacePreset
>;

export function getPlateEmailEditorSurfacePreset(
  surface: PlateEmailEditorSurface,
): PlateEmailEditorSurfacePreset {
  return PLATE_EMAIL_EDITOR_SURFACE_PRESETS[surface];
}

export function resolvePlateEmailEditorFeatureFlags(
  surface: PlateEmailEditorSurface,
  overrides: PlateEmailEditorFeatureOverrides = {},
): PlateEmailEditorFeatureFlags {
  return {
    ...getPlateEmailEditorSurfacePreset(surface).features,
    ...overrides,
  };
}

/**
 * How a document is presented while it is authored.
 *
 * A different axis from `surface`: the composer is one surface and can be in
 * any of these, and so can a signature. Do not fold this into `featureSet`,
 * which describes what a surface may do at all, not how the same surface is
 * dressed.
 *
 * Markdown and Rich text are two presentations of ONE value, not two formats.
 * They share the document model, so switching between them converts nothing
 * and loses nothing. Plain is the textarea composer, which does replace the
 * body with text.
 */
export const PLATE_EMAIL_EDITOR_DIALECTS = [
  'markdown',
  'rich_text',
  'plain',
] as const;

export type PlateEmailEditorDialect =
  (typeof PLATE_EMAIL_EDITOR_DIALECTS)[number];

/**
 * The block chrome a dialect can turn off. Each flag owns one kit in the
 * composer's React kit, so renaming a kit module means renaming it here too.
 *
 * Block selection is deliberately not one of these. It looks like chrome, but
 * it is also an API the AI menu calls unconditionally, and it renders nothing
 * unless a block is already block-selected, which Rich text offers no way to
 * start. Removing it crashed the AI menu rather than quietening it.
 */
export const PLATE_EMAIL_EDITOR_CHROME_FEATURES = [
  'blockDragHandles',
  'slashCommands',
  'blockPlaceholder',
] as const;

export type PlateEmailEditorChromeFeature =
  (typeof PLATE_EMAIL_EDITOR_CHROME_FEATURES)[number];

export type PlateEmailEditorChromeFlags = Readonly<
  Record<PlateEmailEditorChromeFeature, boolean>
>;

export type PlateEmailEditorChromeOverrides = Partial<
  Record<PlateEmailEditorChromeFeature, boolean>
>;

export interface PlateEmailEditorDialectPreset {
  readonly dialect: PlateEmailEditorDialect;
  /** False for the plain dialect, which no Plate editor renders. */
  readonly usesBlockEditor: boolean;
  /** Block-only nodes render through their read-only renderers. */
  readonly readOnlyBlockNodes: boolean;
  readonly chrome: PlateEmailEditorChromeFlags;
}

const blockEditorChrome: PlateEmailEditorChromeFlags = {
  blockDragHandles: true,
  slashCommands: true,
  blockPlaceholder: true,
};

const noChrome: PlateEmailEditorChromeFlags = {
  blockDragHandles: false,
  slashCommands: false,
  blockPlaceholder: false,
};

export const PLATE_EMAIL_EDITOR_DIALECT_PRESETS = {
  markdown: {
    dialect: 'markdown',
    usesBlockEditor: true,
    readOnlyBlockNodes: false,
    chrome: blockEditorChrome,
  },
  rich_text: {
    dialect: 'rich_text',
    usesBlockEditor: true,
    readOnlyBlockNodes: true,
    chrome: noChrome,
  },
  plain: {
    dialect: 'plain',
    usesBlockEditor: false,
    readOnlyBlockNodes: false,
    chrome: noChrome,
  },
} as const satisfies Record<
  PlateEmailEditorDialect,
  PlateEmailEditorDialectPreset
>;

export function getPlateEmailEditorDialectPreset(
  dialect: PlateEmailEditorDialect,
): PlateEmailEditorDialectPreset {
  return PLATE_EMAIL_EDITOR_DIALECT_PRESETS[dialect];
}

export function resolvePlateEmailEditorChromeFlags(
  dialect: PlateEmailEditorDialect,
  overrides: PlateEmailEditorChromeOverrides = {},
): PlateEmailEditorChromeFlags {
  return {
    ...getPlateEmailEditorDialectPreset(dialect).chrome,
    ...overrides,
  };
}
