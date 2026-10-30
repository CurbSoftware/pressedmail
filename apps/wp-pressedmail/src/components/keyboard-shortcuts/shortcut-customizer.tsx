import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { __, sprintf } from "@wordpress/i18n";
import { Keyboard } from "lucide-react";
import {
  Button,
  Dialog,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kit/ui/plugin";

import {
  PressedDialogContent,
  PressedDialogHeader,
  PressedOverlayBody,
  PressedOverlayFooter,
} from "@/components/ui/pressed-overlay";
import { apiFetch } from "@/lib/api-client";
import { getPluginRestBase } from "@/lib/runtime-config";

import { shortcutCatalog } from "./shortcut-catalog";
import { chordFromEvent, isBindableKey, isPlainKey } from "./shortcut-keys";
import { ShortcutKeys, ShortcutMap } from "./shortcut-map";
import {
  refreshShortcutBindings,
  useShortcutBindings,
  type ShortcutBinding,
} from "./use-shortcut-bindings";

/** Keys that move around the dialog instead of being captured. */
const DIALOG_KEYS = new Set(["Tab", "Escape", "Enter", " "]);

async function post(
  path: string,
  body: Record<string, unknown> = {},
): Promise<{ ok: boolean; data: { message?: string; conflict?: string } }> {
  try {
    const response = await apiFetch(`${getPluginRestBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
      conflict?: string;
    };
    return { ok: response.ok, data };
  } catch {
    return { ok: false, data: {} };
  }
}

/**
 * Pro: the shortcut list with a preset picker, and Change and Reset on every
 * row. Changes save at once through the Pro shortcut routes, the way the
 * server keeps them, outside the Preferences save bar. Without the licensed
 * capability this is the plain list.
 */
export function ShortcutCustomizer({
  bindings,
}: {
  bindings: ShortcutBinding[];
}) {
  const { preset } = useShortcutBindings();
  const catalog = shortcutCatalog();
  const presetId = useId();
  const [custom, setCustom] = useState(false);
  const [editing, setEditing] = useState<ShortcutBinding | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastPlain = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiFetch(`${getPluginRestBase()}shortcuts/capabilities`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { custom_shortcuts?: unknown } | null) => {
        if (!cancelled) setCustom(data?.custom_shortcuts === true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!custom) return <ShortcutMap bindings={bindings} />;

  const labelOf = (action: string) => catalog[action]?.label ?? action;

  const run = async (
    path: string,
    body?: Record<string, unknown>,
  ): Promise<boolean> => {
    setBusy(true);
    const result = await post(path, body);
    await refreshShortcutBindings(true);
    setBusy(false);
    return result.ok;
  };

  const startEditing = (binding: ShortcutBinding) => {
    lastPlain.current = null;
    setCaptured(null);
    setError(null);
    setEditing(binding);
  };

  // Two plain keys pressed within a second make a sequence such as "g then i";
  // anything else is the one key, with its modifiers.
  const capture = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (DIALOG_KEYS.has(event.key) && !event.ctrlKey && !event.metaKey) return;
    const chord = chordFromEvent(event.nativeEvent);
    if (!chord) return;
    event.preventDefault();
    const previous = lastPlain.current;
    const next =
      previous &&
      isPlainKey(chord) &&
      event.timeStamp - previous.at < 1000 &&
      captured === previous.key
        ? `${previous.key}+${chord}`
        : chord;
    lastPlain.current = isPlainKey(chord) && next === chord
      ? { key: chord, at: event.timeStamp }
      : null;
    setCaptured(next);
    setError(
      isBindableKey(next)
        ? null
        : __("That key cannot be used as a shortcut.", "pressedmail"),
    );
  };

  const save = async () => {
    if (!editing || !captured) return;
    // The next key after a refused save starts over instead of extending it.
    lastPlain.current = null;
    setBusy(true);
    const result = await post("shortcuts/set", {
      action: editing.action,
      key: captured,
    });
    if (result.ok) {
      await refreshShortcutBindings(true);
      setBusy(false);
      setEditing(null);
      return;
    }
    setBusy(false);
    setError(
      result.data.conflict
        ? sprintf(
            /* translators: %s: the name of another shortcut, such as "Archive". */
            __("That key is already used by %s.", "pressedmail"),
            labelOf(result.data.conflict),
          )
        : (result.data.message ??
            __("The shortcut could not be saved. Try again.", "pressedmail")),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-48 space-y-1.5">
          <Label htmlFor={presetId}>{__("Preset", "pressedmail")}</Label>
          <Select
            value={preset}
            disabled={busy}
            onValueChange={(value) =>
              void run("shortcuts/apply-preset", { preset: value })
            }>
            <SelectTrigger id={presetId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">
                {__("PressedMail", "pressedmail")}
              </SelectItem>
              <SelectItem value="gmail">{__("Gmail", "pressedmail")}</SelectItem>
              <SelectItem value="outlook">
                {__("Outlook", "pressedmail")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          disabled={busy || !bindings.some((binding) => binding.is_custom)}
          onClick={() => void run("shortcuts/reset-all")}>
          {__("Reset all", "pressedmail")}
        </Button>
      </div>

      <ShortcutMap
        bindings={bindings}
        rowAction={(binding) => (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              aria-label={sprintf(
                /* translators: %s: a shortcut name, such as "Archive". */
                __("Change the key for %s", "pressedmail"),
                labelOf(binding.action),
              )}
              onClick={() => startEditing(binding)}>
              {__("Change", "pressedmail")}
            </Button>
            {binding.is_custom && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                aria-label={sprintf(
                  /* translators: %s: a shortcut name, such as "Archive". */
                  __("Put %s back on its usual key", "pressedmail"),
                  labelOf(binding.action),
                )}
                onClick={() =>
                  void run("shortcuts/reset", { action: binding.action })
                }>
                {__("Reset", "pressedmail")}
              </Button>
            )}
          </>
        )}
      />

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}>
        {editing && (
          <PressedDialogContent size="paletteForm" onKeyDown={capture}>
            <PressedDialogHeader
              icon={Keyboard}
              title={sprintf(
                /* translators: %s: a shortcut name, such as "Archive". */
                __("New key for %s", "pressedmail"),
                labelOf(editing.action),
              )}
              description={__(
                "Press the key you want, with Ctrl, Alt or Shift if you like. For a sequence such as g then i, press the two keys one after the other.",
                "pressedmail",
              )}
            />
            <PressedOverlayBody className="space-y-3">
              <div
                role="status"
                aria-live="polite"
                className="flex min-h-12 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
                {captured ? (
                  <ShortcutKeys value={captured} />
                ) : (
                  __("Waiting for a key...", "pressedmail")
                )}
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </PressedOverlayBody>
            <PressedOverlayFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>
                {__("Cancel", "pressedmail")}
              </Button>
              <Button
                disabled={!captured || busy || error !== null}
                onClick={() => void save()}>
                {__("Save", "pressedmail")}
              </Button>
            </PressedOverlayFooter>
          </PressedDialogContent>
        )}
      </Dialog>
    </div>
  );
}
