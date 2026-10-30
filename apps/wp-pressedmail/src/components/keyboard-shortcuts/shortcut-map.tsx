import { useId, type ReactNode } from "react";
import { __, _x } from "@wordpress/i18n";

import {
  CHEATSHEET_KEY,
  shortcutCatalog,
  type ShortcutGroup,
} from "./shortcut-catalog";
import { isApplePlatform, isSequence } from "./shortcut-keys";
import type { ShortcutBinding } from "./use-shortcut-bindings";

function keyLabel(part: string): string {
  const apple = isApplePlatform();
  switch (part) {
    case "ctrl":
      return _x("Ctrl", "keyboard key", "pressedmail");
    case "alt":
      return apple
        ? _x("Option", "keyboard key", "pressedmail")
        : _x("Alt", "keyboard key", "pressedmail");
    case "shift":
      return _x("Shift", "keyboard key", "pressedmail");
    case "meta":
      return apple
        ? _x("Cmd", "keyboard key", "pressedmail")
        : _x("Win", "keyboard key", "pressedmail");
    case "enter":
      return _x("Enter", "keyboard key", "pressedmail");
    case "backspace":
      return _x("Backspace", "keyboard key", "pressedmail");
    case "delete":
      return _x("Delete", "keyboard key", "pressedmail");
    case "arrowup":
      return "↑";
    case "arrowdown":
      return "↓";
    case "arrowleft":
      return "←";
    case "arrowright":
      return "→";
    default:
      return part;
  }
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded border border-primary/40 bg-primary/5 px-1.5 py-0.5 font-mono text-xs text-primary">
      {children}
    </kbd>
  );
}

/** A stored key as people read it: "Shift + I", or "g then i". */
export function ShortcutKeys({ value }: { value: string }) {
  if (isSequence(value)) {
    const [first, second] = value.split("+");
    /* translators: %1$s and %2$s are two keys pressed one after the other, such as "g then i". */
    const template = __("%1$s then %2$s", "pressedmail");
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        {template.split(/(%[12]\$s)/).map((part, index) =>
          part === "%1$s" ? (
            <Kbd key={index}>{first}</Kbd>
          ) : part === "%2$s" ? (
            <Kbd key={index}>{second}</Kbd>
          ) : part.trim() ? (
            <span key={index}>{part.trim()}</span>
          ) : null,
        )}
      </span>
    );
  }
  return <Kbd>{value.split("+").map(keyLabel).join(" + ")}</Kbd>;
}

interface ShortcutMapProps {
  bindings: ShortcutBinding[];
  /** Extra controls at the end of a row, such as Change on Pro. */
  rowAction?: (binding: ShortcutBinding) => ReactNode;
}

/**
 * Every shortcut on two cards, the way the cheatsheet and the settings page
 * both show them. Rows follow the server's list, so an edition without an
 * action (Snooze on Free) never shows its key.
 */
export function ShortcutMap({ bindings, rowAction }: ShortcutMapProps) {
  const catalog = shortcutCatalog();
  const baseId = useId();
  const groups: Array<{ id: ShortcutGroup; title: string }> = [
    { id: "navigation", title: __("Navigation and focus", "pressedmail") },
    { id: "triage", title: __("Triage and compose", "pressedmail") },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((group) => {
        const rows = bindings.filter(
          (binding) => catalog[binding.action]?.group === group.id,
        );
        const headingId = `${baseId}-${group.id}`;
        return (
          <section
            key={group.id}
            aria-labelledby={headingId}
            className="rounded-lg border border-border/70 bg-card p-3">
            <h3
              id={headingId}
              className="mb-2 px-1 text-sm font-semibold text-foreground">
              {group.title}
            </h3>
            <dl className="space-y-1.5">
              {rows.map((binding) => (
                <div
                  key={binding.action}
                  className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-1.5">
                  <dt className="min-w-0 text-sm text-foreground">
                    {catalog[binding.action]?.label}
                  </dt>
                  <dd className="flex shrink-0 items-center gap-2">
                    {binding.enabled ? (
                      <ShortcutKeys value={binding.key} />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {__("Off", "pressedmail")}
                      </span>
                    )}
                    {rowAction?.(binding)}
                  </dd>
                </div>
              ))}
              {group.id === "navigation" && (
                <div className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-1.5">
                  <dt className="min-w-0 text-sm text-foreground">
                    {__("Show keyboard shortcuts", "pressedmail")}
                  </dt>
                  <dd className="flex shrink-0 items-center">
                    <ShortcutKeys value={CHEATSHEET_KEY} />
                  </dd>
                </div>
              )}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
