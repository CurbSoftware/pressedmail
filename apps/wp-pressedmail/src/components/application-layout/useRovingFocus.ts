"use client";

import * as React from "react";

type Orientation = "horizontal" | "vertical";

const ARROWS: Record<Orientation, { previous: string; next: string }> = {
  horizontal: { previous: "ArrowLeft", next: "ArrowRight" },
  vertical: { previous: "ArrowUp", next: "ArrowDown" },
};

const ITEM = "[data-roving-item]";

/** How far Page Up and Page Down move along a vertical list: about a screenful of rows. */
const PAGE_STEP = 6;

const isUsable = (element: HTMLElement) =>
  !element.hasAttribute("disabled") &&
  element.getAttribute("aria-disabled") !== "true";

/**
 * One tab stop for a group of controls, and the arrow keys to move inside it.
 *
 * A toolbar or a list of rows would otherwise cost one Tab press per control,
 * and a list of a hundred notifications a hundred. Mark each control of the
 * group `data-roving-item`. Tab lands on the one that was focused last, or the
 * first, and the arrow keys along the group's axis, Home and End move between
 * them, and Page Up and Page Down move a screenful along a vertical group. The
 * stop is kept on the DOM rather than in state, because rows come and
 * go under it, and a disabled control is skipped rather than made the stop. The
 * one exception is the control that has focus: a click can switch it off while
 * the reader is on it, and the arrow keys still have to lead out from there.
 */
export function useRovingFocus<T extends HTMLElement>(
  orientation: Orientation,
) {
  const node = React.useRef<T | null>(null);
  const stop = React.useRef<HTMLElement | null>(null);

  const all = React.useCallback(
    () => Array.from(node.current?.querySelectorAll<HTMLElement>(ITEM) ?? []),
    [],
  );

  const items = React.useCallback(
    () =>
      all().filter(
        (element) => isUsable(element) || element === document.activeElement,
      ),
    [all],
  );

  const retab = React.useCallback(() => {
    const list = items();
    const current =
      stop.current && list.includes(stop.current) ? stop.current : list[0];
    // Every item is set, the unavailable ones too: a control that is off but
    // focusable would otherwise be the first tab stop, and where a popup puts
    // focus when it opens.
    for (const element of all()) element.tabIndex = element === current ? 0 : -1;
  }, [all, items]);

  // A group inside a popover mounts after the render that opened it, so the
  // render-time pass below cannot see it. Attaching is the moment it exists.
  const ref = React.useCallback(
    (element: T | null) => {
      node.current = element;
      if (element) retab();
    },
    [retab],
  );

  // Every later render can add, remove or disable a control.
  React.useLayoutEffect(retab);

  const onFocus = React.useCallback(
    (event: React.FocusEvent) => {
      const item = (event.target as HTMLElement).closest<HTMLElement>(ITEM);
      if (item && node.current?.contains(item)) {
        stop.current = item;
        retab();
      }
    },
    [retab],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (!target.matches(ITEM)) return;
      const list = items();
      const index = list.indexOf(target);
      const arrows = ARROWS[orientation];
      let next: number;
      if (event.key === arrows.next) next = Math.min(index + 1, list.length - 1);
      else if (event.key === arrows.previous) next = Math.max(index - 1, 0);
      else if (event.key === "PageDown" && orientation === "vertical") {
        next = Math.min(index + PAGE_STEP, list.length - 1);
      } else if (event.key === "PageUp" && orientation === "vertical") {
        next = Math.max(index - PAGE_STEP, 0);
      } else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = list.length - 1;
      else return;
      event.preventDefault();
      list[next]?.focus();
    },
    [items, orientation],
  );

  /** The control to hand focus to when `element` is about to be removed. */
  const neighbourOf = React.useCallback(
    (element: HTMLElement): HTMLElement | null => {
      const list = items();
      const index = list.indexOf(element);
      return list[index + 1] ?? list[index - 1] ?? null;
    },
    [items],
  );

  return { ref, node, onFocus, onKeyDown, neighbourOf, items };
}
