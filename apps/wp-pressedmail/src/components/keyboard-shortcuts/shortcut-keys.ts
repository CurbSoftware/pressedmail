/**
 * Keys as the server stores them (`KeyboardShortcutService::is_bindable_key`):
 * modifiers and one key joined by "+" in the order ctrl, alt, shift, meta
 * (`shift+i`, `ctrl+.`), or two plain keys pressed in turn (`g+i`). Shift is
 * never written for a symbol, because it is already part of the symbol: `#`
 * is Shift+3 on one keyboard and its own key on another.
 */

const MODIFIER_KEYS = new Set([
  "control",
  "alt",
  "shift",
  "meta",
  "altgraph",
  "capslock",
  "dead",
  "unidentified",
  "process",
]);

/** Named keys a shortcut may use, always with a modifier. */
const NAMED_KEYS = new Set([
  "enter",
  "backspace",
  "delete",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
]);

const SYMBOL = /^[#/.,;'[\]\\`=-]$/;

export function isSequence(key: string): boolean {
  return /^[a-z0-9]\+[a-z0-9]$/.test(key);
}

/**
 * The key an event names. Letters and digits fall back to the physical key
 * when the character is not plain ASCII, so Option+E on a Mac (which types
 * "´") and a Cyrillic or Greek layout still reach `e` and `j`.
 */
function eventKey(event: KeyboardEvent): string {
  const key = event.key.toLowerCase();
  if (/^[a-z0-9]$/.test(key)) return key;
  const physical = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(event.code);
  if (physical && (event.altKey || !/^[\x20-\x7e]$/.test(event.key))) {
    return (physical[1] ?? physical[2] ?? "").toLowerCase();
  }
  return key;
}

/**
 * The stored form of one key press, `?` included, or null for a press the app
 * cannot bind: a modifier on its own, a dead key, Escape, Tab, Space.
 */
export function chordFromEvent(event: KeyboardEvent): string | null {
  const key = eventKey(event);
  if (MODIFIER_KEYS.has(key)) return null;
  const symbol = SYMBOL.test(key) || key === "?";
  if (!/^[a-z0-9]$/.test(key) && !symbol && !NAMED_KEYS.has(key)) return null;
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("ctrl");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey && !symbol) parts.push("shift");
  if (event.metaKey) parts.push("meta");
  if (NAMED_KEYS.has(key) && parts.length === 0) return null;
  parts.push(key);
  return parts.join("+");
}

/** Whether a chord is one plain key, the kind a sequence is made of. */
export function isPlainKey(chord: string): boolean {
  return /^[a-z0-9]$/.test(chord);
}

/**
 * Whether a key can be saved as a shortcut, the client copy of the server's
 * rule, so the capture dialog can say so before it asks.
 */
export function isBindableKey(key: string): boolean {
  if (key === "?" || key.length > 50) return false;
  if (isSequence(key)) return true;
  const parts = key.split("+");
  const last = parts.pop() ?? "";
  const mods = parts;
  // Once each, in the order chordFromEvent writes them, or the key never fires.
  const order = ["ctrl", "alt", "shift", "meta"];
  if (
    !mods.every(
      (mod, index) =>
        order.includes(mod) &&
        (index === 0 || order.indexOf(mod) > order.indexOf(mods[index - 1]!)),
    )
  ) {
    return false;
  }
  if (/^[a-z0-9]$/.test(last)) return true;
  if (SYMBOL.test(last)) return !mods.includes("shift");
  return NAMED_KEYS.has(last) && mods.length > 0;
}

/** Apple keyboards label the modifiers differently. */
export function isApplePlatform(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  );
}
