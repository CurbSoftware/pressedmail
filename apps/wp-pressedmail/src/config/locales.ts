/**
 * Supported Locales: single source of truth (TypeScript side)
 *
 * The PressedMail plugin ships translations for the SAME locale set as the
 * PressedMail website (`apps/web-pressedmail/lib/cms/locale-utils.ts`). This
 * module maps each website locale code to its WordPress locale slug (used for
 * the `.po`/`.mo`/`.json` catalog file names and for `wp_set_script_translations`),
 * a native-language label for the in-app switcher, and a browser-language
 * resolver used for first-run default detection.
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

/** Whether a WordPress locale slug is one we ship. */
export function isSupportedWpLocale(wp: string): boolean {
  return SUPPORTED_WP.has(wp);
}

/** Primary-subtag → WP slug for locales that have a single supported region. */
const PRIMARY_TO_WP: Record<string, string> = {
  en: "en_US",
  es: "es_ES",
  fr: "fr_FR",
  de: "de_DE",
  it: "it_IT",
  nl: "nl_NL",
  ja: "ja",
};

/**
 * Resolve a browser language tag (e.g. `navigator.language` like "pt-BR",
 * "zh-Hans-CN", "fr_FR") to the closest supported WordPress slug. Returns
 * {@link DEFAULT_WP_LOCALE} when nothing matches.
 *
 * Portuguese collapses to Brazilian and Chinese collapses to Simplified, since
 * those are the only supported variants.
 */
export function mapBrowserLanguageToLocale(
  navLang: string | null | undefined,
): string {
  if (!navLang) {
    return DEFAULT_WP_LOCALE;
  }

  const normalized = navLang.toLowerCase().replace(/_/g, "-").trim();
  if (normalized === "") {
    return DEFAULT_WP_LOCALE;
  }

  const primary = normalized.split("-")[0] ?? "";

  // Only Simplified Chinese / Brazilian Portuguese are shipped.
  if (primary === "zh") {
    return "zh_CN";
  }
  if (primary === "pt") {
    return "pt_BR";
  }

  return PRIMARY_TO_WP[primary] ?? DEFAULT_WP_LOCALE;
}
