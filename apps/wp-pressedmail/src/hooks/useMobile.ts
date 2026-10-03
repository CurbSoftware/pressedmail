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
 * The viewport width when the primary pointer is coarse (a touch device), else
 * null. Touchscreen laptops report a fine primary pointer, so they never reach
 * the touch rules below.
 */
function coarseViewportWidth(): number | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  try {
    return window.matchMedia("(pointer: coarse)").matches
      ? window.innerWidth
      : null;
  } catch {
    return null;
  }
}

function computeState(width: number, height: number): MobileState {
  const touchViewport = coarseViewportWidth();
  // Phone wins via either signal. The scoped-container width alone misfires
  // inside WP admin: on a real phone the container can stay >= 640px until
  // immersive mode collapses the admin menu, and immersive mode only runs once
  // the phone shell mounts. A coarse pointer on a sub-phone viewport breaks
  // that deadlock; the viewport guard keeps touch laptops out.
  const isMobile =
    width < BREAKPOINTS.phone ||
    (touchViewport !== null && touchViewport < BREAKPOINTS.phone);
  // The same deadlock one size up: a 1024px touch screen (iPad Mini
  // landscape) is a tablet until the tablet shell hides the admin menu, and
  // the width that frees must not then flip it to desktop. Otherwise the
  // tablet/desktop split stays container-based, so the in-admin desktop
  // responsive preview (narrow container, fine pointer) is preserved.
  const isTablet =
    !isMobile &&
    ((width >= BREAKPOINTS.phone && width < BREAKPOINTS.tablet) ||
      (touchViewport !== null && touchViewport <= BREAKPOINTS.tablet));
  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
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
