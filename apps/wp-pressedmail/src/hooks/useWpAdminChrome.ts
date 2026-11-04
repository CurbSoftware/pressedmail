"use client";

import { useEffect, useState } from "react";

export interface WpAdminChromeState {
  adminBarHeight: number;
  hasAdminBar: boolean;
  adminMenuFolded: boolean;
  /**
   * The height the admin menu takes, which is how tall the page has to be.
   *
   * WordPress keeps the menu fixed while it fits the window and drops the
   * `sticky-menu` body class when it does not, which turns the menu into a
   * column that grows the page. Layout code reads this so the app can fill the
   * page rather than stopping at the fold.
   */
  adminMenuHeight: number;
}

const EMPTY: WpAdminChromeState = {
  adminBarHeight: 0,
  hasAdminBar: false,
  adminMenuFolded: false,
  adminMenuHeight: 0,
};

function readState(): WpAdminChromeState {
  if (typeof document === "undefined") return EMPTY;
  const bar = document.getElementById("wpadminbar");
  const isImmersive = document.body.classList.contains("pressedmail-immersive");
  const adminBarHeight =
    bar && !isImmersive ? Math.round(bar.getBoundingClientRect().height) : 0;
  const menu = document.getElementById("adminmenuwrap");
  return {
    adminBarHeight,
    hasAdminBar: !!bar,
    adminMenuFolded: document.body.classList.contains("folded"),
    adminMenuHeight: menu ? Math.round(menu.getBoundingClientRect().height) : 0,
  };
}

/**
 * Observes the WordPress admin chrome: the #wpadminbar height, the #adminmenu
 * sidebar's height and whether it is folded, so layout code can reserve the
 * right amount of viewport without fighting WP.
 */
export function useWpAdminChrome(): WpAdminChromeState {
  const [state, setState] = useState<WpAdminChromeState>(() => readState());

  useEffect(() => {
    const update = () => setState(readState());
    update();

    let resizeObserver: ResizeObserver | null = null;
    const observed = ["wpadminbar", "adminmenuwrap"]
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (observed.length > 0 && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(update);
      observed.forEach((element) => resizeObserver?.observe(element));
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
