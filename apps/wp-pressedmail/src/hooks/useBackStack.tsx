"use client";

import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface BackStackEntry {
  key: string;
  path: string;
  title?: string;
}

export interface BackStackApi {
  depth: number;
  canGoBack: boolean;
  push: (path: string, title?: string) => void;
  pop: () => void;
  setCurrentTitle: (title: string) => void;
  previousTitle: string | undefined;
  currentTitle: string | undefined;
}

const BackStackContext = React.createContext<BackStackApi | null>(null);

export function BackStackProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const pendingTitle = React.useRef<string | undefined>(undefined);
  const lastKey = React.useRef<string>(location.key);

  const [trail, setTrail] = React.useState<BackStackEntry[]>(() => [
    { key: location.key, path: location.pathname },
  ]);

  React.useEffect(() => {
    if (location.key === lastKey.current) return;
    lastKey.current = location.key;
    const incomingTitle = pendingTitle.current;
    pendingTitle.current = undefined;
    setTrail((prev) => {
      const existing = prev.findIndex((entry) => entry.key === location.key);
      if (existing >= 0) {
        return prev.slice(0, existing + 1);
      }
      return [
        ...prev,
        { key: location.key, path: location.pathname, title: incomingTitle },
      ];
    });
  }, [location.key, location.pathname]);

  const api = React.useMemo<BackStackApi>(
    () => ({
      depth: trail.length - 1,
      canGoBack: trail.length > 1,
      push: (path, title) => {
        pendingTitle.current = title;
        navigate(path);
      },
      // A cold start on a detail route (reload, mailto deep link) has nothing
      // behind it, and navigate(-1) would leave the app entirely. Fall back to
      // the inbox so Back always lands somewhere inside the shell.
      pop: () => {
        if (trail.length > 1) {
          navigate(-1);
          return;
        }
        navigate("/inbox", { replace: true });
      },
      setCurrentTitle: (title) => {
        setTrail((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (!last || last.title === title) return prev;
          const next = prev.slice(0, -1);
          next.push({ ...last, title });
          return next;
        });
      },
      previousTitle:
        trail.length > 1 ? trail[trail.length - 2]?.title : undefined,
      currentTitle: trail[trail.length - 1]?.title,
    }),
    [trail, navigate],
  );

  return (
    <BackStackContext.Provider value={api}>
      {children}
    </BackStackContext.Provider>
  );
}

/**
 * Read the mobile shell back-stack. Must be called inside a BackStackProvider
 * (typically mounted by MobileAppShell). Returns push/pop helpers that mirror
 * useNavigate without forking history, plus depth/previousTitle for back-button
 * rendering.
 */
export function useBackStack(): BackStackApi {
  const ctx = React.useContext(BackStackContext);
  if (!ctx) {
    throw new Error("useBackStack must be used inside a BackStackProvider");
  }
  return ctx;
}

/**
 * Soft variant of useBackStack: returns null instead of throwing when the
 * surrounding provider is absent. Used by shared shell primitives that may
 * be mounted both inside and outside the phone shell.
 */
export function useOptionalBackStack(): BackStackApi | null {
  return React.useContext(BackStackContext);
}
