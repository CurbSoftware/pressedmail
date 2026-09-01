"use client";

import { useEffect } from "react";

import { useIsPhone, useIsTablet } from "@/hooks/useMobile";

/**
 * Applies `data-pm-shell="phone"` or `data-pm-shell="tablet"` to the host
 * element matched by `elementId` so the phone-shell CSS overrides
 * (safe-area, touch-target, font clamp) engage. Cleared on unmount and on
 * desktop widths. Mirrors the inline effect in ApplicationLayout so the
 * standalone frontend portal can opt into the same behaviour.
 */
export function useApplyShellMode(elementId: string): void {
  const isPhone = useIsPhone();
  const isTablet = useIsTablet();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.getElementById(elementId);
    if (!root) return;
    if (isPhone) root.setAttribute("data-pm-shell", "phone");
    else if (isTablet) root.setAttribute("data-pm-shell", "tablet");
    else root.removeAttribute("data-pm-shell");
    return () => root.removeAttribute("data-pm-shell");
  }, [elementId, isPhone, isTablet]);
}
