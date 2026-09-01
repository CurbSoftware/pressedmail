"use client";

import { useState, useEffect, useCallback } from "react";

interface MobileState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
}

/**
 * Breakpoints for responsive detection.
 * - phone (isMobile): < 640px - single-column app shell
 * - tablet (isTablet): 640-1023px - adaptive layout, collapsed sidebars
 * - desktop (isDesktop): >= 1024px - full multi-pane layout
 *
 * The desktop threshold is 1024 (Tailwind lg) so the under-1024 band can
 * adopt the mobile-app shell with bottom tab bar + drilldown navigation.
 */
const BREAKPOINTS = {
  phone: 640,
  tablet: 1024,
} as const;

function readContainerWidth(): number {
  if (typeof document === "undefined") return 1920;
  const container =
    document.getElementById("pressedmail-plugin") ||
    document.getElementById("pressedmail-plugin-frontend");
  return container?.clientWidth || window.innerWidth;
}

/**
 * True for an actual touch phone: a coarse pointer AND a sub-phone viewport.
 *
 * The scoped-container width alone misfires inside WP admin, the container can
 * stay >= 640px on a real phone until immersive mode collapses the admin menu,
 * but immersive mode only runs *after* the phone shell mounts (the shell renders
 * the immersive toggle). That deadlock is why phones fall through to the legacy
 * layout. This capability signal breaks the deadlock without per-device checks.
 *
 * The `innerWidth < phone` guard is essential: touchscreen laptops report a
 * coarse pointer but must never be forced into the phone shell.
 */
function isCoarsePhoneViewport(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return (
      window.matchMedia("(pointer: coarse)").matches &&
      window.innerWidth < BREAKPOINTS.phone
    );
  } catch {
    return false;
  }
}

function computeState(width: number, height: number): MobileState {
  // Phone wins via either signal; tablet/desktop stay strictly container-based so
  // the in-admin desktop responsive preview (narrow container, fine pointer) is
  // preserved and a coarse phone with a wide container never reads as tablet.
  const isMobile = width < BREAKPOINTS.phone || isCoarsePhoneViewport();
  return {
    isMobile,
    isTablet: !isMobile && width >= BREAKPOINTS.phone && width < BREAKPOINTS.tablet,
    isDesktop: !isMobile && width >= BREAKPOINTS.tablet,
    width,
    height,
    orientation: height > width ? "portrait" : "landscape",
  };
}

/**
 * Hook for detecting mobile devices and responsive breakpoints.
 * Returns device type and dimensions for responsive layouts.
 *
 * Uses container width when running in WordPress admin context,
 * falling back to viewport width otherwise.
 */
export function useMobile(): MobileState {
  const [state, setState] = useState<MobileState>(() => {
    if (typeof window === "undefined") {
      return computeState(1920, 1080);
    }
    return computeState(readContainerWidth(), window.innerHeight);
  });

  const handleResize = useCallback(() => {
    setState(computeState(readContainerWidth(), window.innerHeight));
  }, []);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    handleResize();

    const container =
      document.getElementById("pressedmail-plugin") ||
      document.getElementById("pressedmail-plugin-frontend");
    let resizeObserver: ResizeObserver | null = null;

    if (container && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
    }

    // Re-evaluate the coarse-pointer signal if the pointer type changes
    // (e.g. a 2-in-1 toggling between tablet and laptop modes).
    let pointerQuery: MediaQueryList | null = null;
    if (typeof window.matchMedia === "function") {
      try {
        pointerQuery = window.matchMedia("(pointer: coarse)");
        pointerQuery.addEventListener?.("change", handleResize);
      } catch {
        pointerQuery = null;
      }
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      resizeObserver?.disconnect();
      pointerQuery?.removeEventListener?.("change", handleResize);
    };
  }, [handleResize]);

  return state;
}

/**
 * True when the plugin container is narrower than the phone breakpoint (< 640px).
 * Use this to switch into the native-mobile-app shell.
 */
export function useIsPhone(): boolean {
  const { isMobile } = useMobile();
  return isMobile;
}

/**
 * True when the plugin container is in the tablet band (640px - 1023px).
 */
export function useIsTablet(): boolean {
  const { isTablet } = useMobile();
  return isTablet;
}

/**
 * True when the plugin container is desktop-width (>= 1024px).
 */
export function useIsDesktopPlus(): boolean {
  const { isDesktop } = useMobile();
  return isDesktop;
}

/**
 * Alias for useIsPhone, retained for source compatibility with callers
 * written before the phone/tablet split.
 */
export function useIsMobile(): boolean {
  return useIsPhone();
}

/**
 * True when the container is below desktop width (phone or tablet).
 */
export function useIsMobileOrTablet(): boolean {
  const { isMobile, isTablet } = useMobile();
  return isMobile || isTablet;
}
