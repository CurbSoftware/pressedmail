"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const IMMERSIVE_BODY_CLASS = "pressedmail-immersive";

// Immersive mode is one body class, so it is one piece of shared state. Every
// consumer subscribes to the DOM truth rather than keeping its own copy,
// otherwise a second writer (the composer's full view, say) flips the class
// and the header toggle keeps showing the opposite label.
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when the WordPress chrome is currently hidden. */
export function isImmersiveModeActive() {
  if (typeof document === "undefined") return false;
  return document.body.classList.contains(IMMERSIVE_BODY_CLASS);
}

/** Hides the WordPress admin bar and side menu. */
export function enableImmersiveMode() {
  if (typeof document === "undefined") return;
  document.body.classList.add(IMMERSIVE_BODY_CLASS);
  document.documentElement.style.setProperty("padding-top", "0px", "important");
  document.documentElement.style.setProperty("margin-top", "0px", "important");
  document.documentElement.style.setProperty("--wp-admin-bar-height", "0px");
  notify();
}

export function restoreWordPressChrome() {
  if (typeof document === "undefined") return;
  document.body.classList.remove(IMMERSIVE_BODY_CLASS);
  document.documentElement.style.removeProperty("padding-top");
  document.documentElement.style.removeProperty("margin-top");
  const adminBar = document.getElementById("wpadminbar");
  const adminBarHeight = adminBar?.offsetHeight ?? 32;
  document.documentElement.style.setProperty(
    "--wp-admin-bar-height",
    `${adminBarHeight}px`,
  );
  notify();
}

export interface UseImmersiveModeApi {
  isImmersive: boolean;
  toggle: () => void;
  enable: () => void;
  disable: () => void;
}

export function useImmersiveMode(defaultEnabled = false): UseImmersiveModeApi {
  const isImmersive = useSyncExternalStore(
    subscribe,
    isImmersiveModeActive,
    () => defaultEnabled,
  );

  useEffect(() => {
    if (defaultEnabled || isImmersiveModeActive()) {
      enableImmersiveMode();
    }
  }, [defaultEnabled]);

  const enable = useCallback(() => {
    enableImmersiveMode();
  }, []);

  const disable = useCallback(() => {
    restoreWordPressChrome();
  }, []);

  const toggle = useCallback(() => {
    if (isImmersiveModeActive()) {
      restoreWordPressChrome();
      return;
    }
    enableImmersiveMode();
  }, []);

  return { isImmersive, toggle, enable, disable };
}

export default useImmersiveMode;
