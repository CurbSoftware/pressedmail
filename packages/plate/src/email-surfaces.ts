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
    features: baseAuthoringFeatures,
  },
  auto_reply: {
    surface: 'auto_reply',
    featureSet: 'email-automation',
    className: 'pm-plate-auto-reply-surface',
    defaultMinHeight: 260,
    features: baseAuthoringFeatures,
  },
  content_block: {
    surface: 'content_block',
    featureSet: 'reusable-content',
    className: 'pm-plate-content-block-surface',
    defaultMinHeight: 260,
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
