/**
 * i18n bootstrap (client)
 *
 * The SPA's `__()` resolves through WordPress's own `wp.i18n`: the build
 * externalises `@wordpress/i18n` to that global, and
 * `wp_set_script_translations()` in `includes/Assets/Admin.php` makes WordPress
 * load the matching `pressedmail-<locale>-<md5>.json` before the bundle runs,
 * whether it shipped with the plugin or came from a WordPress.org language
 * pack. Admin selects the user's PressedMail language without changing other
 * WordPress scripts. The eight bundled catalogs currently translate core
 * controls only.
 *
 * This module reads the server's resolved language and saves new choices. The
 * page then reloads so WordPress provides one consistent script catalogue.
 *
 * @since 3.0.0
 */

import { apiFetch } from "@/lib/api-client";

import { getRuntimeRestNamespace } from "@/lib/runtime-config";

export type LocaleData = Record<string, unknown>;

function getPlugin(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  return (
    (window.pressedmailPlugin as Record<string, unknown> | undefined) ?? {}
  );
}

function getApiUrl(): string {
  return String(getPlugin().apiUrl ?? "");
}

/** The locale the server resolved for this user. */
export function readServerLocale(): string {
  const value = getPlugin().locale;
  return typeof value === "string" ? value : "";
}

/**
 * Locales this site has a PressedMail catalogue for. Empty when the server did
 * not say, which is every context outside a real plugin screen.
 */
export function readAvailableLocales(): string[] {
  const value = getPlugin().availableLocales;
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

/**
 * A WordPress locale slug as a BCP 47 language tag, for the `lang` attribute.
 * Chinese carries its script rather than its country, which is what assistive
 * technology needs to pick a voice.
 */
export function toBcp47(wp: string): string {
  if (!wp) return "";
  if (wp === "zh_CN") return "zh-Hans";
  if (wp === "zh_TW") return "zh-Hant";
  return wp.replace(/_/g, "-");
}

/**
 * A language's name, in the interface's language and in its own.
 *
 * For locales PressedMail lists itself the names are in `config/locales.ts`.
 * This is for the rest: a WordPress profile language like `en_GB` or `pt_PT`
 * becomes the active locale, and printing `pt_PT` where a language name belongs
 * tells the reader nothing. `Intl.DisplayNames` is the platform's own answer,
 * and it needs no catalogue and no network.
 */
export function describeLocale(wp: string): {
  label: string;
  nativeLabel: string;
} {
  const tag = toBcp47(wp);
  return {
    label: languageName(tag, "en"),
    nativeLabel: languageName(tag, tag),
  };
}

function languageName(tag: string, inLanguage: string): string {
  try {
    return (
      new Intl.DisplayNames([inLanguage], {
        type: "language",
        languageDisplay: "dialect",
      }).of(tag) ?? tag
    );
  } catch {
    // A malformed tag throws RangeError, and an environment without full ICU
    // data can be missing DisplayNames entirely.
    return tag;
  }
}

export interface PersistedLocale {
  locale: string;
  catalog: LocaleData | null;
}

/**
 * Persist the plugin-scoped locale server-side. The caller reloads so WordPress
 * applies translations throughout the page, including static module labels.
 */
export async function persistLocale(
  wp: string,
): Promise<PersistedLocale | null> {
  try {
    const response = await apiFetch(
      `${getApiUrl()}${getRuntimeRestNamespace()}/user/locale`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locale: wp }),
      },
    );
    const data = await response.json();
    if (data?.status === "success") {
      return {
        locale: typeof data.locale === "string" ? data.locale : wp,
        catalog: (data.catalog as LocaleData | null) ?? null,
      };
    }
  } catch (error) {
    console.error("PressedMail: failed to persist locale", error);
  }
  return null;
}
