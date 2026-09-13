/**
 * Modal behaviour for a panel that switches between an inline and an overlay
 * layout without remounting its content.
 *
 * Radix Dialog would be the default choice, but its content must be a React
 * child of Dialog.Content, so moving the composer in and out of it remounts the
 * Plate editor and loses unsaved keystrokes and undo history. Its scroll lock
 * also decides "inside" by React tree, so any reparenting trick would block
 * scrolling inside the composer. This hook gives the same guarantees on the
 * existing element instead:
 *
 * - the rest of the page is `inert` (not focusable, not clickable, hidden from
 *   assistive tech), except live regions, so toasts are still announced;
 * - Tab and Shift+Tab wrap inside the panel;
 * - Escape calls `onEscape`, unless a nested layer (popover, menu, alert
 *   dialog) already handled it.
 *
 * Focus return is left to the caller, because only the caller knows which
 * control opened the overlay and whether it still exists.
 */
import { useCallback, useEffect, type KeyboardEvent, type RefObject } from "react";

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]';

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "LINK", "TEMPLATE", "NOSCRIPT"]);

/** Mark everything outside `keep` inert; returns the undo. */
export function inertOthers(keep: HTMLElement[]): () => void {
  const onPath = new Set<Element>();
  for (const element of keep) {
    for (let node: Element | null = element; node; node = node.parentElement) {
      onPath.add(node);
    }
  }

  const changed: Element[] = [];
  const walk = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      if (keep.includes(child as HTMLElement)) continue;
      if (onPath.has(child)) {
        walk(child);
        continue;
      }
      if (SKIP_TAGS.has(child.tagName) || child.hasAttribute("inert")) continue;
      child.setAttribute("inert", "");
      changed.push(child);
    }
  };
  walk(document.body);

  return () => {
    for (const element of changed) element.removeAttribute("inert");
  };
}

/**
 * Whether the element is actually shown. A tabbable inside display:none or
 * visibility:hidden cannot take focus, so treating it as the first or last
 * stop would let Tab walk out of the panel. jsdom and older Safari lack
 * checkVisibility, hence the computed-style walk.
 */
function isShown(element: HTMLElement): boolean {
  if (typeof element.checkVisibility === "function") {
    return element.checkVisibility({ visibilityProperty: true });
  }
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (getComputedStyle(node).display === "none") return false;
  }
  return getComputedStyle(element).visibility !== "hidden";
}

function tabbables(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.hidden &&
      !element.closest("[inert]") &&
      isShown(element),
  );
}

export function useModalPanel({
  panelRef,
  active,
  onEscape,
}: {
  panelRef: RefObject<HTMLElement | null>;
  active: boolean;
  onEscape: () => void;
}) {
  useEffect(() => {
    const panel = panelRef.current;
    if (!active || !panel) return;

    const liveRegions = Array.from(
      document.querySelectorAll<HTMLElement>("[aria-live]"),
    ).filter((region) => !panel.contains(region));
    return inertOthers([panel, ...liveRegions]);
  }, [active, panelRef]);

  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const panel = panelRef.current;
      const target = event.target as Element | null;
      // Portalled popovers bubble through the React tree too; only keys that
      // happen inside this panel's DOM, and not inside a nested dialog, count.
      if (
        !active ||
        !panel ||
        !target ||
        !panel.contains(target) ||
        target.closest('[role="dialog"], [role="alertdialog"]') !== panel
      ) {
        return;
      }

      if (event.key === "Escape") {
        if (event.defaultPrevented) return;
        event.preventDefault();
        onEscape();
        return;
      }

      if (event.key !== "Tab") return;
      const items = tabbables(panel);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const current = document.activeElement;
      if (event.shiftKey && (current === first || current === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || current === panel)) {
        event.preventDefault();
        first.focus();
      }
    },
    [active, onEscape, panelRef],
  );
}
