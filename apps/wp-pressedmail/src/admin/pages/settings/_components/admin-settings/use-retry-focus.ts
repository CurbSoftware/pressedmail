import { useCallback, useEffect, useRef } from "react";

/**
 * Keeps the keyboard where it was when a Retry works.
 *
 * A Retry button sits in an alert that goes away once the retry succeeds, and
 * focus on a removed button drops to the top of the page. So the alert is left
 * up while it retries, and when the retry works the cursor moves to the results
 * the alert was standing in for. A retry that fails again changes nothing: the
 * alert and the cursor on its button stay where they are. Someone who has moved
 * the cursor elsewhere while it loaded keeps it there.
 *
 * @param busy   Whether a request is in flight.
 * @param failed Whether the last request failed.
 * @returns `target`, for the element that holds the results (it needs
 *   `tabIndex={-1}`), and `retry`, which the button calls with the loader.
 */
export function useRetryFocus<T extends HTMLElement>(
  busy: boolean,
  failed: boolean,
) {
  const target = useRef<T>(null);
  const asked = useRef(false);
  // What had been asked when this render ran. An effect belongs to the render
  // that made it, so one still waiting from the commit that put the alert up
  // (Retry pressed the moment it appeared) must not spend the press that came
  // after it: it would end the wait before the retry had even started.
  const askedWhenRendered = asked.current;

  useEffect(() => {
    if (!askedWhenRendered || busy) return;

    asked.current = false;

    // Only when the cursor is still where the removed button left it. Someone
    // who has moved on to something else while it loaded keeps their place.
    const held = document.activeElement;
    if (!failed && (!held || held === document.body)) target.current?.focus();
  }, [busy, failed]);

  const retry = useCallback((load: () => void) => {
    asked.current = true;
    load();
  }, []);

  return { target, retry };
}
