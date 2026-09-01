"use client";

import { useEffect, useState } from "react";

export interface WpAdminChromeState {
  adminBarHeight: number;
  hasAdminBar: boolean;
  adminMenuFolded: boolean;
}

const EMPTY: WpAdminChromeState = {
  adminBarHeight: 0,
  hasAdminBar: false,
  adminMenuFolded: false,
};

function readState(): WpAdminChromeState {
  if (typeof document === "undefined") return EMPTY;
  const bar = document.getElementById("wpadminbar");
  const isImmersive = document.body.classList.contains("pressedmail-immersive");
  const adminBarHeight =
    bar && !isImmersive ? Math.round(bar.getBoundingClientRect().height) : 0;
  return {
    adminBarHeight,
    hasAdminBar: !!bar,
    adminMenuFolded: document.body.classList.contains("folded"),
  };
}

/**
 * Observes the WordPress admin chrome: the #wpadminbar height and whether
 * the #adminmenu sidebar is folded, so mobile layout code can reserve
 * the right amount of viewport without fighting WP.
 */
export function useWpAdminChrome(): WpAdminChromeState {
  const [state, setState] = useState<WpAdminChromeState>(() => readState());

  useEffect(() => {
    const update = () => setState(readState());
    update();

    let resizeObserver: ResizeObserver | null = null;
    const bar = document.getElementById("wpadminbar");
    if (bar && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(bar);
    }

    const mutationObserver =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(update)
        : null;
    mutationObserver?.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, []);

  return state;
}
