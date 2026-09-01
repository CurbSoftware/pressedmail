"use client";

import * as React from "react";

export interface MobileLayoutContextValue {
  isTabBarHidden: boolean;
  setTabBarHidden: (hidden: boolean) => void;
  isDragBackDisabled: boolean;
  setDragBackDisabled: (disabled: boolean) => void;
}

const MobileLayoutContext =
  React.createContext<MobileLayoutContextValue | null>(null);

export function MobileLayoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isTabBarHidden, setTabBarHidden] = React.useState(false);
  const [isDragBackDisabled, setDragBackDisabled] = React.useState(false);

  const value = React.useMemo<MobileLayoutContextValue>(
    () => ({
      isTabBarHidden,
      setTabBarHidden,
      isDragBackDisabled,
      setDragBackDisabled,
    }),
    [isTabBarHidden, isDragBackDisabled],
  );

  return (
    <MobileLayoutContext.Provider value={value}>
      {children}
    </MobileLayoutContext.Provider>
  );
}

export function useMobileLayout(): MobileLayoutContextValue {
  const ctx = React.useContext(MobileLayoutContext);
  if (!ctx) {
    throw new Error(
      "useMobileLayout must be used inside a MobileLayoutProvider",
    );
  }
  return ctx;
}

/**
 * Returns the mobile layout context if present, otherwise null. Lets shared
 * primitives (MobileScreen, edge-swipe glue) work both inside and outside
 * the phone shell without throwing.
 */
export function useOptionalMobileLayout(): MobileLayoutContextValue | null {
  return React.useContext(MobileLayoutContext);
}

/**
 * Imperative helper for screens that need to hide the tab bar while mounted
 * (e.g. mail reader, compose). Restores previous state on unmount.
 *
 * Reads the context optionally: the dedicated mobile routes (/compose, /search,
 * /settings/:section, …) mount their screens even on a desktop/tablet-wide
 * viewport, where MobileAppShell (and thus MobileLayoutProvider) is not
 * rendered, so this must degrade to a no-op rather than throw.
 */
export function useHideTabBar(hidden: boolean = true): void {
  const ctx = useOptionalMobileLayout();
  const setTabBarHidden = ctx?.setTabBarHidden;
  React.useEffect(() => {
    if (!setTabBarHidden) return;
    setTabBarHidden(hidden);
    return () => setTabBarHidden(false);
  }, [hidden, setTabBarHidden]);
}
