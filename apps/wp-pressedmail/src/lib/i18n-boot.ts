/**
 * i18n bootstrap (client)
 *
 * The Vite SPA bundles its own copy of `@wordpress/i18n` (there is no global
 * `window.wp.i18n`), and the production script `src` is content-hashed so WP's
 * `<domain>-<locale>-<md5>.json` auto-loader is unreliable. Instead, PHP injects
 * the active locale's Jed catalog as `window.pressedmailLocaleData`, and this
 * module applies it to the bundled `@wordpress/i18n` at startup. On first run
 * (no server locale yet) the LocaleProvider uses {@link detectBrowserLocale} +
 * {@link persistLocale} to default to the user's browser language.
 *
 * @since 3.0.0
 */

import { setLocaleData } from "@wordpress/i18n";
import { apiFetch } from "@/lib/api-client";

import { mapBrowserLanguageToLocale } from "@/config/locales";
import { getRuntimeRestNamespace } from "@/lib/runtime-config";

const DOMAIN = "pressedmail";

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

/** The locale the server resolved ('' = first run → detect the browser). */
export function readServerLocale(): string {
  const value = getPlugin().locale;
  return typeof value === "string" ? value : "";
}

/** Map a browser language tag to a supported WordPress slug. */
export function detectBrowserLocale(navLang?: string): string {
  const lang =
    navLang ?? (typeof navigator !== "undefined" ? navigator.language : "");
  return mapBrowserLanguageToLocale(lang);
}

/** Apply a catalog to the bundled `@wordpress/i18n` (or reset to source English). */
export function applyLocaleData(catalog: LocaleData | null | undefined): void {
  setLocaleData(catalog ?? { "": { domain: DOMAIN } }, DOMAIN);
}

/** Apply the server-injected catalog synchronously, before the first render. */
export function applyInjectedLocaleData(): void {
  if (typeof window !== "undefined" && window.pressedmailLocaleData) {
    setLocaleData(window.pressedmailLocaleData, DOMAIN);
  }
}

export interface PersistedLocale {
  locale: string;
  catalog: LocaleData | null;
}

/**
 * Persist the plugin-scoped locale server-side. The response carries the new
 * catalog so the caller can swap the UI language immediately (no reload).
 */
export async function persistLocale(
  wp: string,
): Promise<PersistedLocale | null> {
  try {
    const response = await apiFetch(`${getApiUrl()}${getRuntimeRestNamespace()}/user/locale`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ locale: wp }),
    });
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
