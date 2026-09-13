/**
 * Locale Provider
 *
 * Owns the plugin-scoped UI language for the React SPA. Because `__()` is not
 * reactive, switching language bumps a version counter that re-keys the child
 * subtree, forcing every component to re-render with the new strings.
 *
 * The starting language comes from the server: the user's PressedMail choice,
 * or their WordPress profile language. Nothing is guessed from the browser and
 * nothing is written to their profile until they pick a language themselves.
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
  applyLocaleData,
  describeLocale,
  toBcp47,
} from "@/lib/i18n-boot";

// Module-level version store: every setLocaleData bumps the version so the
// keyed subtree below re-mounts and re-evaluates all __() calls.
const listeners = new Set<() => void>();
let version = 0;

function bumpVersion(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getVersion(): number {
  return version;
}

/**
 * The languages worth offering: the ones this site has a catalogue for, plus
 * the active one so the control always shows what is in use. Offering a
 * language with no catalogue only renames the setting; every string stays
 * English. The active one can be a WordPress profile language PressedMail
 * carries no label for, so it is named through `Intl.DisplayNames` rather than
 * printed as a slug.
 */
function offeredLocales(active: string): readonly SupportedLocale[] {
  const available = readAvailableLocales();
  if (available.length === 0) {
    return SUPPORTED_LOCALES;
  }

  const wanted = new Set([...available, active].filter(Boolean));

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
  /** Persist + apply a new locale (live, no reload). */
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
  locales: SUPPORTED_LOCALES,
  saving: false,
};

const LocaleContext = React.createContext<LocaleContextValue>(DEFAULT_CONTEXT);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const v = React.useSyncExternalStore(subscribe, getVersion, getVersion);
  const [locale, setLocaleState] = React.useState<string>(
    () => readServerLocale() || DEFAULT_WP_LOCALE,
  );
  const [saving, setSaving] = React.useState(false);

  const setLocale = React.useCallback(async (wp: string) => {
    setSaving(true);
    try {
      const result = await persistLocale(wp);
      if (!result) {
        return false;
      }

      setLocaleState(result.locale);

      if (result.catalog) {
        // The catalog came back with the response: swap it in place.
        applyLocaleData(result.catalog);
        bumpVersion();
      } else {
        // WordPress prints the script translations for the locale it resolves
        // per request, so the new language arrives with the next page load.
        window.location.reload();
      }

      return true;
    } finally {
      setSaving(false);
    }
  }, []);

  const value = React.useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, locales: offeredLocales(locale), saving }),
    [locale, setLocale, saving],
  );

  return (
    <LocaleContext.Provider value={value}>
      <PluginThemeScopeProvider value={{ lang: toBcp47(locale) }}>
        {/* WCAG 3.1.2: PressedMail can run in a different language from the
          wp-admin around it, and a screen reader needs to be told, or it reads
          the whole interface with the wrong pronunciation rules. */}
        <div style={{ display: "contents" }} key={v} lang={toBcp47(locale)}>
          {children}
        </div>
      </PluginThemeScopeProvider>
    </LocaleContext.Provider>
  );
}

export function useLocaleContext(): LocaleContextValue {
  return React.useContext(LocaleContext);
}
