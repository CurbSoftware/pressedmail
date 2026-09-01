import type { ReactNode } from "react";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      enableSystem
      disableTransitionOnChange
      enableColorScheme={false}
      defaultTheme={defaultTheme}
      storageKey={storageKey}>
      {children}
    </NextThemesProvider>
  );
}

export { useTheme };
