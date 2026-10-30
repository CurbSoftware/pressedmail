import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { __ } from "@wordpress/i18n";

import type { RegisterSettingsDraft } from "@/components/settings-ui";
import { SettingsSectionCard } from "@/components/settings-ui";
import { ShortcutMap } from "@/components/keyboard-shortcuts/shortcut-map";
import {
  saveShortcutsEnabled,
  useShortcutBindings,
} from "@/components/keyboard-shortcuts/use-shortcut-bindings";
import { appMessage } from "@/context/toast";

import { PreferenceSwitchRow } from "./preference-controls";

/** The switch is not a user preference key: it lives in /shortcuts/settings. */
export const KEYBOARD_SHORTCUT_KEYS = [] as const;

// Rebinding and presets are Pro. Free compiles neither the component nor its chunk.
const ShortcutCustomizer = __IS_FREE__
  ? null
  : lazy(async () => {
      const module = await import(
        "@/components/keyboard-shortcuts/shortcut-customizer"
      );
      return { default: module.ShortcutCustomizer };
    });

export function KeyboardShortcutsSection({
  registerDraft,
}: {
  registerDraft: RegisterSettingsDraft;
}) {
  const { bindings, enabled } = useShortcutBindings();
  const [draft, setDraft] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const value = draft ?? enabled;
  const dirty = draft !== null && draft !== enabled;

  const save = useCallback(async (): Promise<boolean> => {
    if (!dirty || draft === null) return true;
    setSaving(true);
    const saved = await saveShortcutsEnabled(draft);
    setSaving(false);
    if (saved) {
      setDraft(null);
    } else {
      appMessage(
        __("Keyboard shortcuts could not be saved. Try again.", "pressedmail"),
        "error",
      );
    }
    return saved;
  }, [dirty, draft]);

  const cancel = useCallback(() => setDraft(null), []);

  useEffect(() => {
    registerDraft("keyboard-shortcuts", { dirty, saving, save, cancel });
    return () => registerDraft("keyboard-shortcuts", null);
  }, [cancel, dirty, registerDraft, save, saving]);

  const map = <ShortcutMap bindings={bindings} />;

  return (
    <SettingsSectionCard
      dataTest="preference-section-keyboard-shortcuts"
      title={__("Keyboard shortcuts", "pressedmail")}
      description={__(
        "Move through your mail and act on it without the mouse. Press ? anywhere in PressedMail to see this list.",
        "pressedmail",
      )}>
      <PreferenceSwitchRow
        title={__("Use keyboard shortcuts", "pressedmail")}
        description={__(
          "Turn this off if single-key shortcuts get in your way, for example when you use speech input.",
          "pressedmail",
        )}
        checked={value}
        onCheckedChange={setDraft}
        dataTest="pref-keyboard-shortcuts-enabled"
      />
      {value &&
        (ShortcutCustomizer ? (
          <Suspense fallback={map}>
            <ShortcutCustomizer bindings={bindings} />
          </Suspense>
        ) : (
          map
        ))}
    </SettingsSectionCard>
  );
}
