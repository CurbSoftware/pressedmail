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
    const value = localStorage.getItem(STORAGE_KEY) ?? initialTheme;
    return isThemeAvailable(value) ? value : initialTheme;
  } catch {
    return initialTheme;
  }
}

function applyThemeClass(themeId: string): void {
  if (typeof document === "undefined") return;
  const roots = [
    document.body,
    document.getElementById("pressedmail-plugin"),
    document.getElementById("pressedmail-plugin-frontend"),
    ...document.querySelectorAll<HTMLElement>(
      "[data-radix-portal], [data-pm-portal]",
    ),
  ].filter((root): root is HTMLElement => root instanceof HTMLElement);

  for (const root of roots) {
    for (const className of Array.from(root.classList)) {
      if (className.endsWith("-theme")) root.classList.remove(className);
    }
    root.classList.add(`${themeId}-theme`);
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
          localStorage.setItem(STORAGE_KEY, themeId);
        } catch {
          // A blocked storage API must not stop a theme change.
        }
      }
    },
    [persistTheme],
  );

  useEffect(() => {
    applyThemeClass(currentTheme);
  }, [currentTheme]);

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
