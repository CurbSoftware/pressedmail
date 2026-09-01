/**
 * Email/canvas background colors support opaque RGB and RGB with alpha.
 * Keep this contract shared so the picker, compose state, drafts, and send
 * sanitizer cannot disagree about whether an eight-digit color is valid.
 */
export const COMPOSER_BACKGROUND_COLOR_PATTERN =
  /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;

export function normalizeComposerBackgroundColor(
  value?: string | null,
): string | undefined {
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  return COMPOSER_BACKGROUND_COLOR_PATTERN.test(normalized)
    ? normalized
    : undefined;
}

export function isComposerBackgroundColor(value?: string | null): boolean {
  return normalizeComposerBackgroundColor(value) !== undefined;
}
