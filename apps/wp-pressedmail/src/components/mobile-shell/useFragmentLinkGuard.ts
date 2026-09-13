"use client";

import * as React from "react";

/**
 * Keep in-page fragment links out of the hash router.
 *
 * The SPA runs on createHashRouter, so every `location.hash` write is a route
 * change. WordPress prints its own "Skip to main content" link
 * (`<a href="#wpbody-content">`) above every admin page, and the plugin prints
 * a "Skip to content" link of its own. Activating either used to resolve as
 * the route `/wpbody-content`, match nothing, and fall through the catch-all
 * to `/inbox`: the one control a keyboard or screen reader user has for
 * skipping the chrome threw them out of Settings, Contacts or a half-written
 * message instead of moving focus (WCAG 2.4.1 Bypass Blocks).
 *
 * A capture-phase listener claims fragment links that are not routes, meaning
 * anything whose href does not start with `#/`, and does what the link was
 * always meant to do: move focus to the target. Route links are left alone.
 */
export function useFragmentLinkGuard(): void {
  React.useEffect(() => {
    if (typeof document === "undefined") return;

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      // Let the browser keep new-tab / new-window gestures.
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      // The literal attribute, not the resolved `.href` property, which the
      // browser expands to an absolute URL and would hide the `#/` prefix.
      const href = anchor.getAttribute("href") ?? "";
      if (!href.startsWith("#")) return;
      // `#/inbox`, `#/settings/accounts`, ...: a route, so the router owns it.
      if (href.startsWith("#/")) return;

      const id = href.slice(1);
      if (!id) return;

      let destination: HTMLElement | null;
      try {
        destination = document.getElementById(decodeURIComponent(id));
      } catch {
        destination = document.getElementById(id);
      }
      if (!destination) return;

      event.preventDefault();
      // Core's #wpbody-content is a plain div: not focusable, so a skip link
      // that only scrolls leaves the keyboard exactly where it was. Make it
      // focusable, but never touch something that already is. Stamping
      // tabindex="-1" on a real control (a button, a link, a field) would pull
      // it out of the tab order, which is a worse bug than the one being
      // fixed.
      const alreadyFocusable =
        destination.hasAttribute("tabindex") || destination.tabIndex >= 0;
      if (!alreadyFocusable) {
        destination.setAttribute("tabindex", "-1");
      }
      destination.focus({ preventScroll: true });
      // jsdom does not implement scrollIntoView.
      destination.scrollIntoView?.({ block: "start" });
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);
}

export default useFragmentLinkGuard;
