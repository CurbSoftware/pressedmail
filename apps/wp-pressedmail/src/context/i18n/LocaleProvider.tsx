/**
 * Locale Provider
 *
 * Owns the plugin-scoped UI language for the React SPA. WordPress loads script
 * translations before the bundle runs, so a saved language change reloads the
 * page to update both static and rendered strings consistently.
 *
 * The starting language comes from the server's resolved user choice or
 * WordPress profile language. Only catalogues the server can load are offered.
 * The eight bundled catalogues currently cover core controls, not the full UI.
 *
 * @since 3.0.0
 */

import * as React from "react";
import { PluginThemeScopeProvider } from "@kit/ui/plugin";

import {
  SUPPORTED_LOCALES,
  DEFAULT_WP_LOCALE,
  type SupportedLocale,
} from "@/config/locales";
import {
  readServerLocale,
  readAvailableLocales,
  persistLocale,
  describeLocale,
  toBcp47,
} from "@/lib/i18n-boot";

/**
 * Offer only languages the server certifies as available. A missing runtime
 * list must not turn every incomplete translation into a picker option.
 */
function offeredLocales(): readonly SupportedLocale[] {
  const available = readAvailableLocales();
  const wanted = new Set([DEFAULT_WP_LOCALE, ...available]);

  return [
    ...SUPPORTED_LOCALES.filter((entry) => wanted.has(entry.wp)),
    ...[...wanted]
      .filter((wp) => !SUPPORTED_LOCALES.some((entry) => entry.wp === wp))
      .map((wp) => ({ code: wp, wp, ...describeLocale(wp) })),
  ];
}

interface LocaleContextValue {
  /** Active WordPress locale slug. */
  locale: string;
  /** Persist a new locale and reload with WordPress's script translations. */
  setLocale: (wp: string) => Promise<boolean>;
  /** Supported locales for a switcher. */
  locales: readonly SupportedLocale[];
  /** Whether a language change is in flight. */
  saving: boolean;
}

// A safe default so components embedding the switcher (e.g. the settings tab)
// still render outside a provider, switching is a no-op until wrapped.
const DEFAULT_CONTEXT: LocaleContextValue = {
  locale: DEFAULT_WP_LOCALE,
  setLocale: async () => false,
  locales: [SUPPORTED_LOCALES[0]!],
  saving: false,
};

const LocaleContext = React.createContext<LocaleContextValue>(DEFAULT_CONTEXT);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale] = React.useState<string>(() => {
    const resolved = readServerLocale();
    return resolved === DEFAULT_WP_LOCALE ||
      readAvailableLocales().includes(resolved)
      ? resolved
      : DEFAULT_WP_LOCALE;
  });
  const [saving, setSaving] = React.useState(false);

  const setLocale = React.useCallback(async (wp: string) => {
    setSaving(true);
    try {
      const result = await persistLocale(wp);
      if (!result) {
        return false;
      }

      window.location.reload();

      return true;
    } finally {
      setSaving(false);
    }
  }, []);

  const value = React.useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, locales: offeredLocales(), saving }),
    [locale, setLocale, saving],
  );

  return (
    <LocaleContext.Provider value={value}>
      <PluginThemeScopeProvider value={{ lang: toBcp47(locale) }}>
        {/* WCAG 3.1.2: PressedMail can run in a different language from the
          wp-admin around it, and a screen reader needs to be told, or it reads
          the whole interface with the wrong pronunciation rules. */}
        <div style={{ display: "contents" }} lang={toBcp47(locale)}>
          {children}
        </div>
      </PluginThemeScopeProvider>
    </LocaleContext.Provider>
  );
}

export function useLocaleContext(): LocaleContextValue {
  return React.useContext(LocaleContext);
}
