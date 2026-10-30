import { useEffect, useRef } from "react";

/**
 * Who answers each shortcut right now.
 *
 * The keyboard listener knows keys, not the inbox. Each surface that owns an
 * action registers it while it is mounted: the reading pane registers Reply
 * and Archive, the message list registers j and k. A key whose surface is not
 * on screen does nothing, and nothing is threaded through a context for it.
 * When two surfaces register one action, the one mounted last answers.
 */
const handlers = new Map<string, Array<() => void>>();

export function useShortcutHandler(
  action: string,
  handler: () => void,
  enabled = true,
): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;
    const entry = () => latest.current();
    handlers.set(action, [...(handlers.get(action) ?? []), entry]);
    return () => {
      const remaining = (handlers.get(action) ?? []).filter(
        (candidate) => candidate !== entry,
      );
      if (remaining.length > 0) handlers.set(action, remaining);
      else handlers.delete(action);
    };
  }, [action, enabled]);
}

/** Run an action's current handler. False when nothing on screen answers it. */
export function runShortcut(action: string): boolean {
  const stack = handlers.get(action);
  const handler = stack?.[stack.length - 1];
  if (!handler) return false;
  handler();
  return true;
}

/**
 * Whether a key press belongs to the control it lands on: an input, a
 * textarea, a select, an editor, or a combobox, spin box or slider, which
 * read letters and arrows themselves (a Radix Select jumps to an option).
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest(
      "input, textarea, select, [contenteditable='true'], [role='combobox'], [role='spinbutton'], [role='slider']",
    ) !== null
  );
}
