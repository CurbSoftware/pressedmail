/**
 * Free mounts three authoring surfaces: the composer, signatures and content
 * blocks. Auto-replies and templates are Pro, so their presets stay out of the
 * Free build. See email-surfaces.ts.
 */
import {
  PLATE_CONTENT_BLOCK_SURFACE_PRESET,
  PLATE_EMAIL_SURFACE_PRESET,
  PLATE_SIGNATURE_SURFACE_PRESET,
  type PlateEmailEditorFeatureFlags,
  type PlateEmailEditorFeatureOverrides,
  type PlateEmailEditorSurface,
  type PlateEmailEditorSurfacePreset,
} from "@kit/plate/email-surfaces";

export * from "@kit/plate/email-surfaces";

const FREE_SURFACE_PRESETS: Partial<
  Record<PlateEmailEditorSurface, PlateEmailEditorSurfacePreset>
> = {
  email: PLATE_EMAIL_SURFACE_PRESET,
  signature: PLATE_SIGNATURE_SURFACE_PRESET,
  content_block: PLATE_CONTENT_BLOCK_SURFACE_PRESET,
};

export function getPlateEmailEditorSurfacePreset(
  surface: PlateEmailEditorSurface,
): PlateEmailEditorSurfacePreset {
  return FREE_SURFACE_PRESETS[surface] ?? PLATE_EMAIL_SURFACE_PRESET;
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
