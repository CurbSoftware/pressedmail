import { safeLocalStorage } from "@/lib/preference-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PluginThemeScopeProvider } from "@kit/ui/plugin";

import {
  DARK_STATUS_TEXT_LIGHTNESS,
  LIGHT_STATUS_TEXT_LIGHTNESS,
  STATUS_TEXT_TOKEN_SOURCES,
  themeTextUtilityCss,
  withOklchLightness,
} from "./status-text-tokens";

interface ThemeStyles {
  container: string;
  mailListContainer: string;
  mailDisplayContainer: string;
  navContainer: string;
  searchContainer: string;
}

interface ThemeContextValue {
  currentTheme: string;
  setTheme: (themeId: string) => void;
  isPro: false;
  availableThemes: string[];
  isThemeAvailable: (themeId: string) => boolean;
  theme: ThemeStyles;
  customTheme: null;
  setCustomTheme: () => void;
  canUseCustomTheme: false;
  themeType: "default" | "standard";
}

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: string;
  persistTheme?: boolean;
}

const DEFAULT_THEME = "pressedm";
const STORAGE_KEY = "pressedmail-selected-theme";
export const THEME_OVERRIDE_STYLE_ID = "pm-theme-overrides";
export const FREE_THEME_IDS = [DEFAULT_THEME, "contrast"] as const;
const AVAILABLE_THEMES = [...FREE_THEME_IDS];
const EMPTY_STYLES: ThemeStyles = {
  container: "",
  mailListContainer: "",
  mailDisplayContainer: "",
  navContainer: "",
  searchContainer: "",
};

const isThemeAvailable = (themeId: string) =>
  AVAILABLE_THEMES.includes(themeId as (typeof FREE_THEME_IDS)[number]);

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const fallback: ThemeContextValue = {
  currentTheme: DEFAULT_THEME,
  setTheme: () => undefined,
  isPro: false,
  availableThemes: AVAILABLE_THEMES,
  isThemeAvailable,
  theme: EMPTY_STYLES,
  customTheme: null,
  setCustomTheme: () => undefined,
  canUseCustomTheme: false,
  themeType: "default",
};

function storedTheme(initialTheme: string, persistTheme: boolean): string {
  if (typeof window === "undefined" || !persistTheme) return initialTheme;
  try {
    const value = safeLocalStorage().getItem(STORAGE_KEY) ?? initialTheme;
    return isThemeAvailable(value) ? value : initialTheme;
  } catch {
    return initialTheme;
  }
}

/** Everything a theme applies to: both app roots, the body, and open portals. */
function themeRoots(): HTMLElement[] {
  return [
    document.body,
    document.getElementById("pressedmail-plugin"),
    document.getElementById("pressedmail-plugin-frontend"),
    ...document.querySelectorAll<HTMLElement>(
      "[data-radix-portal], [data-pm-portal]",
    ),
  ].filter((root): root is HTMLElement => root instanceof HTMLElement);
}

function applyThemeClass(themeId: string): void {
  if (typeof document === "undefined") return;

  for (const root of themeRoots()) {
    for (const className of Array.from(root.classList)) {
      if (className.endsWith("-theme")) root.classList.remove(className);
    }
    root.classList.add(`${themeId}-theme`);
  }
}

/**
 * Give the status and primary colours a text-safe variant and point the text
 * utilities at it.
 *
 * The Free themes are plain CSS, so nothing here reads a palette registry: the
 * applied fill is read back off the element and only its lightness moves. Free
 * used to skip this entirely, which left `.text-warning` resolving to the fill
 * and status text sitting at 3.17:1 to 3.87:1 on the dark card. Free is the
 * edition on wordpress.org, so it is the one that had to be fixed.
 *
 * A fill that is not OKLCH leaves its token unset, and the CSS falls back to
 * the fill, so an unparsed colour renders as it did before instead of losing
 * its colour.
 */
function applyStatusTextTokens(isDark: boolean): void {
  if (typeof document === "undefined") return;

  const roots = themeRoots();
  const source = roots.find((root) => root !== document.body) ?? document.body;
  const computed = window.getComputedStyle(source);
  const lightness = isDark
    ? DARK_STATUS_TEXT_LIGHTNESS
    : LIGHT_STATUS_TEXT_LIGHTNESS;

  for (const [token, fill] of Object.entries(STATUS_TEXT_TOKEN_SOURCES)) {
    const base = computed.getPropertyValue(fill).trim();
    const derived = base ? withOklchLightness(base, lightness) : "";

    for (const root of roots) {
      if (derived && derived !== base) {
        root.style.setProperty(token, derived);
      } else {
        root.style.removeProperty(token);
      }
    }
  }

  let styleEl = document.getElementById(THEME_OVERRIDE_STYLE_ID);

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = THEME_OVERRIDE_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  const css = themeTextUtilityCss();

  if (styleEl.textContent !== css) {
    styleEl.textContent = css;
  }
}

export function ThemeProvider({
  children,
  initialTheme = DEFAULT_THEME,
  persistTheme = true,
}: ThemeProviderProps) {
  const safeInitialTheme = isThemeAvailable(initialTheme)
    ? initialTheme
    : DEFAULT_THEME;
  const [currentTheme, setCurrentTheme] = useState(() =>
    storedTheme(safeInitialTheme, persistTheme),
  );
  const [isDark, setIsDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );

  const setTheme = useCallback(
    (themeId: string) => {
      if (!isThemeAvailable(themeId)) return;
      setCurrentTheme(themeId);
      if (persistTheme) {
        try {
          safeLocalStorage().setItem(STORAGE_KEY, themeId);
        } catch {
          // A blocked storage API must not stop a theme change.
        }
      }
    },
    [persistTheme],
  );

  useEffect(() => {
    applyThemeClass(currentTheme);
    applyStatusTextTokens(isDark);
  }, [currentTheme, isDark]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...fallback,
      currentTheme,
      setTheme,
      themeType: currentTheme === DEFAULT_THEME ? "default" : "standard",
    }),
    [currentTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <PluginThemeScopeProvider
        value={{ themeClass: `${currentTheme}-theme`, isDark, style: {} }}>
        {children}
      </PluginThemeScopeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? fallback;
}

export function useAvailableThemes(): string[] {
  return useTheme().availableThemes;
}
