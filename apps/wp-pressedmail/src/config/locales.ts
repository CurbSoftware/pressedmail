/**
 * Supported Locales: single source of truth (TypeScript side)
 *
 * Labels for the shared website locale set. The language switcher offers only
 * locales with installed plugin catalogues, as reported by WordPress.
 *
 * Keep this in lockstep with the PHP mirror at
 * `plugin-files/includes/I18n/Locales.php`, the parity is enforced by
 * `locales.test.ts`.
 *
 * @since 3.0.0
 */

export interface SupportedLocale {
  /** Website locale code (e.g. "pt-br"). */
  code: string;
  /** WordPress locale slug used for catalog file names (e.g. "pt_BR"). */
  wp: string;
  /** English label. */
  label: string;
  /** Native-language label shown in the language switcher. */
  nativeLabel: string;
}

/** Fallback locale when nothing else resolves (English, untranslated source). */
export const DEFAULT_WP_LOCALE = "en_US";

/**
 * The 9 supported locales, in website order. `en` is the source language and
 * ships no catalog (strings render from source).
 */
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = [
  { code: "en", wp: "en_US", label: "English", nativeLabel: "English" },
  { code: "es", wp: "es_ES", label: "Spanish", nativeLabel: "Español" },
  { code: "fr", wp: "fr_FR", label: "French", nativeLabel: "Français" },
  { code: "de", wp: "de_DE", label: "German", nativeLabel: "Deutsch" },
  { code: "it", wp: "it_IT", label: "Italian", nativeLabel: "Italiano" },
  {
    code: "pt-br",
    wp: "pt_BR",
    label: "Portuguese (Brazil)",
    nativeLabel: "Português (Brasil)",
  },
  { code: "nl", wp: "nl_NL", label: "Dutch", nativeLabel: "Nederlands" },
  { code: "ja", wp: "ja", label: "Japanese", nativeLabel: "日本語" },
  {
    code: "zh-hans",
    wp: "zh_CN",
    label: "Chinese (Simplified)",
    nativeLabel: "简体中文",
  },
] as const;

/** Set of supported WordPress slugs for quick membership checks. */
const SUPPORTED_WP = new Set(SUPPORTED_LOCALES.map((l) => l.wp));

/** Whether a WordPress locale slug has a built-in label. */
export function isSupportedWpLocale(wp: string): boolean {
  return SUPPORTED_WP.has(wp);
}
