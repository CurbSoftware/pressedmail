'use client';

import * as React from 'react';

const DEFAULT_THEME_CLASS = 'default-theme';

export interface PluginThemeSnapshot {
  themeClass: string;
  isDark: boolean;
  style?: React.CSSProperties;
  lang?: string;
}

interface PluginThemeScopeValue extends Partial<PluginThemeSnapshot> {}

const PluginThemeScopeContext =
  React.createContext<PluginThemeScopeValue | null>(null);

export function PluginThemeScopeProvider({
  children,
  value,
}: React.PropsWithChildren<{ value: PluginThemeScopeValue }>) {
  const inherited = React.useContext(PluginThemeScopeContext);
  return React.createElement(
    PluginThemeScopeContext.Provider,
    { value: { ...inherited, ...value } },
    children,
  );
}

function getThemeSnapshot(): PluginThemeSnapshot {
  if (typeof document === 'undefined') {
    return { themeClass: DEFAULT_THEME_CLASS, isDark: false };
  }

  const body = document.body;
  const html = document.documentElement;
  const pluginRoot =
    document.getElementById('pressedmail-plugin') ||
    document.getElementById('pressedmail-plugin-frontend') ||
    document.querySelector('[data-pm-theme-root]') ||
    document.querySelector('.pressedmail-frontend');

  const getThemeFromElement = (element: Element | null): string | null => {
    if (!element) return null;
    return (
      Array.from(element.classList).find((c) => c.endsWith('-theme')) ?? null
    );
  };

  const themeClass =
    getThemeFromElement(pluginRoot) ||
    getThemeFromElement(body) ||
    DEFAULT_THEME_CLASS;

  const isDark =
    html.classList.contains('dark') ||
    body.classList.contains('dark') ||
    Boolean(pluginRoot?.classList.contains('dark'));

  return { themeClass, isDark };
}

/**
 * Hook to detect current theme class from the body element.
 * Returns the theme class name and dark mode state.
 *
 * Used by plugin portal components (Dialog, Select, etc.) to ensure
 * CSS theme variables are inherited when rendered outside the main container.
 *
 * The hook uses a MutationObserver to detect theme class changes on the body
 * element and only updates state when the theme actually changes.
 */
export function useThemeClass(): PluginThemeSnapshot {
  const scope = React.useContext(PluginThemeScopeContext);
  const [snapshot, setSnapshot] = React.useState(getThemeSnapshot);

  React.useEffect(() => {
    if (scope?.themeClass || scope?.isDark !== undefined) {
      return;
    }

    let mounted = true;
    const body = document.body;
    const html = document.documentElement;
    const pluginRoot =
      document.getElementById('pressedmail-plugin') ||
      document.getElementById('pressedmail-plugin-frontend') ||
      document.querySelector('[data-pm-theme-root]') ||
      document.querySelector('.pressedmail-frontend');

    const detectTheme = () => {
      if (!mounted) return;
      const nextSnapshot = getThemeSnapshot();
      setSnapshot((current) =>
        current.themeClass === nextSnapshot.themeClass &&
        current.isDark === nextSnapshot.isDark
          ? current
          : nextSnapshot,
      );
    };

    // Initial detection
    detectTheme();

    // Watch for class changes on both body (theme class) and html (dark mode via next-themes)
    const observer = new MutationObserver(() => {
      detectTheme();
    });

    observer.observe(body, { attributes: true, attributeFilter: ['class'] });
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    if (pluginRoot) {
      observer.observe(pluginRoot, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    return () => {
      mounted = false;
      observer.disconnect();
    };
  }, [scope?.isDark, scope?.themeClass]);

  return {
    themeClass: scope?.themeClass ?? snapshot.themeClass,
    isDark: scope?.isDark ?? snapshot.isDark,
    style: scope?.style ?? snapshot.style,
    lang: scope?.lang,
  };
}
