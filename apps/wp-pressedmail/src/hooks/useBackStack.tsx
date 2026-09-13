"use client";

import * as React from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";

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
  const navigationType = useNavigationType();
  const pendingTitle = React.useRef<string | undefined>(undefined);
  const lastLocation = React.useRef(location);

  const [trail, setTrail] = React.useState<BackStackEntry[]>(() => [
    { key: location.key, path: location.pathname },
  ]);

  React.useEffect(() => {
    if (location === lastLocation.current) return;
    lastLocation.current = location;
    const incomingTitle = pendingTitle.current;
    pendingTitle.current = undefined;
    setTrail((prev) => {
      const entry = {
        key: location.key,
        path: location.pathname,
        title: incomingTitle,
      };
      // Tab destinations start a fresh in-app trail without rewriting browser history.
      if (location.state?.pmMobileTabRoot === true) return [entry];
      // Consuming mailto/share query fields replaces the current browser entry.
      // Counting it as a push makes later exit deltas overshoot the real trail.
      if (navigationType === "REPLACE") {
        return [
          ...prev.slice(0, -1),
          {
            ...entry,
            title:
              incomingTitle ??
              (prev[prev.length - 1]?.path === location.pathname
                ? prev[prev.length - 1]?.title
                : undefined),
          },
        ];
      }
      // Native hash entries have no router key. They all read as "default",
      // so an incoming compose must not alias the cold-start entry.
      const existing =
        location.key === "default" && location.pathname === "/compose"
          ? -1
          : prev.findIndex(
              (entry) =>
                entry.key === location.key && entry.path === location.pathname,
            );
      if (existing >= 0) {
        return prev.slice(0, existing + 1);
      }
      return [...prev, entry];
    });
  }, [location, navigationType]);

  const api = React.useMemo<BackStackApi>(() => {
    let destination = trail.length - 2;
    // Each external entry can add another compose URL. Leaving this editor
    // must return to the last real screen instead of reopening an empty one.
    if (location.pathname === "/compose") {
      while (destination >= 0 && trail[destination]?.path === "/compose") {
        destination -= 1;
      }
    }
    return {
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
        if (destination >= 0) {
          navigate(destination - (trail.length - 1));
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
      previousTitle: destination >= 0 ? trail[destination]?.title : undefined,
      currentTitle: trail[trail.length - 1]?.title,
    };
  }, [trail, navigate, location.pathname]);

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
