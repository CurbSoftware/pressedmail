import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { __ } from "@wordpress/i18n";
import { Keyboard } from "lucide-react";
import { Button, Dialog } from "@kit/ui/plugin";

import {
  PressedDialogContent,
  PressedDialogHeader,
  PressedOverlayBody,
  PressedOverlayFooter,
} from "@/components/ui/pressed-overlay";
import { useAppContext } from "@/context/AppProvider";
import { usePaneCompose } from "@/context/composer";

import { CHEATSHEET_KEY } from "./shortcut-catalog";
import { chordFromEvent, isPlainKey, isSequence } from "./shortcut-keys";
import { ShortcutMap } from "./shortcut-map";
import {
  isEditableTarget,
  runShortcut,
  useShortcutHandler,
} from "./shortcut-registry";
import { useShortcutBindings } from "./use-shortcut-bindings";

/** How long the second key of a sequence such as "g then i" is waited for. */
const SEQUENCE_WINDOW_MS = 1000;

/**
 * Something open that owns the keyboard: a dialog, a popover, a menu, a
 * select, or one of the app's own modal panels (the popped-out composer, the
 * event form, the lock screen), which say so with aria-modal.
 */
const OPEN_OVERLAY = [
  ...["dialog", "alertdialog", "menu", "listbox"].map(
    (role) => `[role="${role}"][data-state="open"]`,
  ),
  '[aria-modal="true"]',
].join(", ");

/** Holding a key down moves through the list; it never archives or deletes a run of mail. */
const REPEATABLE = new Set(["next_email", "prev_email"]);

/** WordPress's own admin bar and menu share the page; keys there are theirs. */
const WORDPRESS_CHROME = "#wpadminbar, #adminmenumain";

/**
 * The one keyboard listener for the app, and the "?" list of every shortcut.
 *
 * Keys are matched against the person's bindings and handed to whichever
 * surface registered the action (shortcut-registry.ts). Nothing happens while
 * someone types, while a dialog or menu is open, or when they have turned
 * shortcuts off in Preferences, which is what WCAG 2.1.4 asks of single-key
 * shortcuts.
 */
export function KeyboardShortcuts() {
  const { bindings, enabled } = useShortcutBindings();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const paneCompose = usePaneCompose();
  const { accounts, setIsAddAccount } = useAppContext();

  // Folders are picked through the inbox URL, the path notifications use, so
  // the sidebar highlights the folder and Starred is shown as the view it is.
  // Sent and Drafts go by role: the inbox looks up what this provider calls them.
  useShortcutHandler("go_inbox", () => navigate("/inbox?folder=INBOX"));
  useShortcutHandler("go_starred", () => navigate("/inbox?folder=starred"));
  useShortcutHandler("go_sent", () => navigate("/inbox?role=sent"));
  useShortcutHandler("go_drafts", () => navigate("/inbox?role=drafts"));
  // The same path as the speed dial's Compose.
  useShortcutHandler("compose", () => {
    navigate("/inbox");
    if (accounts.length === 0) setIsAddAccount(true);
    else paneCompose?.requestPaneCompose();
  });

  useEffect(() => {
    if (!enabled) return;
    const keymap = new Map<string, string>();
    for (const binding of bindings) {
      if (binding.enabled) keymap.set(binding.key, binding.action);
    }
    let pending: { key: string; at: number } | null = null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const chord = chordFromEvent(event);
      if (!chord) return;
      if (
        isEditableTarget(event.target) ||
        (event.target instanceof Element &&
          event.target.closest(WORDPRESS_CHROME)) ||
        document.querySelector(OPEN_OVERLAY)
      ) {
        pending = null;
        return;
      }
      if (chord === CHEATSHEET_KEY) {
        event.preventDefault();
        setOpen(true);
        return;
      }

      const first =
        pending && event.timeStamp - pending.at < SEQUENCE_WINDOW_MS
          ? pending.key
          : null;
      pending = null;
      const action =
        (first && keymap.get(`${first}+${chord}`)) || keymap.get(chord);
      if (action && event.repeat && !REPEATABLE.has(action)) return;
      if (action) {
        if (runShortcut(action)) event.preventDefault();
        return;
      }
      if (
        isPlainKey(chord) &&
        [...keymap.keys()].some((key) => isSequence(key) && key[0] === chord)
      ) {
        pending = { key: chord, at: event.timeStamp };
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [bindings, enabled]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {open && (
        <PressedDialogContent
          size="form"
          onKeyDown={(event) => {
            if (event.key === CHEATSHEET_KEY) {
              event.preventDefault();
              setOpen(false);
            }
          }}>
          <PressedDialogHeader
            icon={Keyboard}
            title={__("Keyboard shortcuts", "pressedmail")}
            description={__(
              "Press ? again or Escape to close this list.",
              "pressedmail",
            )}
          />
          <PressedOverlayBody>
            <ShortcutMap bindings={bindings} />
          </PressedOverlayBody>
          <PressedOverlayFooter className="sm:items-center sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                navigate("/settings/preferences?category=keyboard");
              }}>
              {__("Change shortcuts", "pressedmail")}
            </Button>
            <Button autoFocus onClick={() => setOpen(false)}>
              {__("Done", "pressedmail")}
            </Button>
          </PressedOverlayFooter>
        </PressedDialogContent>
      )}
    </Dialog>
  );
}
