/**
 * Locale Provider
 *
 * Owns the plugin-scoped UI language for the React SPA. Because `__()` is not
 * reactive, switching language bumps a version counter that re-keys the child
 * subtree, forcing every component to re-render with the new strings. On first
 * run (no server locale) it detects the browser language and persists it.
 *
 * @since 3.0.0
 */

import * as React from "react";

import {
  SUPPORTED_LOCALES,
  DEFAULT_WP_LOCALE,
  type SupportedLocale,
} from "@/config/locales";
import {
  readServerLocale,
  detectBrowserLocale,
  persistLocale,
  applyLocaleData,
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
  const detectedRef = React.useRef(false);

  const setLocale = React.useCallback(async (wp: string) => {
    setSaving(true);
    try {
      const result = await persistLocale(wp);
      if (!result) {
        return false;
      }
      applyLocaleData(result?.catalog ?? null);
      setLocaleState(result?.locale ?? wp);
      bumpVersion();
      return true;
    } finally {
      setSaving(false);
    }
  }, []);

  React.useEffect(() => {
    if (detectedRef.current) return;
    detectedRef.current = true;
    // First run: no stored server locale → default to the browser language.
    if (readServerLocale() === "") {
      const target = detectBrowserLocale();
      if (target && target !== DEFAULT_WP_LOCALE) {
        void setLocale(target);
      }
    }
  }, [setLocale]);

  const value = React.useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, locales: SUPPORTED_LOCALES, saving }),
    [locale, setLocale, saving],
  );

  return (
    <LocaleContext.Provider value={value}>
      <div style={{ display: "contents" }} key={v}>
        {children}
      </div>
    </LocaleContext.Provider>
  );
}

export function useLocaleContext(): LocaleContextValue {
  return React.useContext(LocaleContext);
}
