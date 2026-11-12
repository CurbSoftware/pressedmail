/**
 * Free's companion slots: none. Companions need PressedMail Pro, and the Free
 * build ships no slot host, so it resolves `companions.active` to this file
 * (see edition-aliases.cjs) and every placement renders nothing. The shapes are
 * declared here so the screens that place the slots typecheck in both editions,
 * and so the Pro module (companions.tsx) implements exactly them.
 */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import type {
  ConnectionEditorConnection,
  ConnectionEditorInput,
  ConnectionEditorSaveResult,
} from "../../../../packages/pressedmail-companion/src/contract";

/** A companion's settings tab, ready for the desktop and phone settings lists. */
export interface CompanionSettingsTab {
  /** `companion-<id>`, the tab's address in `?tab=` and `/settings/<id>`. */
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  content: ReactNode;
}

/** Settings tabs, in their declared order. */
export function companionSettingsTabs(): CompanionSettingsTab[] {
  return [];
}

/**
 * What `?tab=<tab>` shows when it names a companion's settings tab that is
 * not here: the plugin is off, or the person may not open its tab. Null for
 * any other tab. Free has no companion tabs, so the page falls back to its
 * default tab as it does for any unknown one.
 */
export function unavailableCompanionTab(_tab: string): ReactNode {
  return null;
}

/**
 * Companion items for a New menu, and the dialog they open. Render `dialog`
 * outside the menu: a menu's items unmount as it closes.
 */
export interface CompanionLibraryActions {
  items: ReactNode;
  dialog: ReactNode;
}

export function useCompanionLibraryActions(
  _openTemplate: (id: number) => void,
): CompanionLibraryActions {
  return { items: null, dialog: null };
}

/** What a saved template's settings panel hands each companion section. */
export interface CompanionEditorPanelsProps {
  templateId: number;
  revision: number;
  context: string;
  readOnly: boolean;
  dirty: boolean;
  reload: () => void;
}

export function CompanionEditorPanels(_props: CompanionEditorPanelsProps): ReactNode {
  return null;
}

/** Toolbar buttons that open a companion's insert dialog, for one editor surface. */
export interface CompanionInsertButtonsProps {
  surface: "composer" | "template";
  disabled?: boolean;
}

export function CompanionInsertButtons(_props: CompanionInsertButtonsProps): ReactNode {
  return null;
}

/** The form of a WordPress email connection another plugin provides, and what it is handed. */
export interface CompanionConnectionEditorProps {
  /** The connection's transport type. The companion that declared it draws the form. */
  type: string;
  /** The providing service's name, or "" when it was never known. */
  typeLabel: string;
  /** False while the plugin that provides the type is off. */
  typeActive: boolean;
  mode: "create" | "edit";
  connection: ConnectionEditorConnection | null;
  onSave: (input: ConnectionEditorInput) => Promise<ConnectionEditorSaveResult>;
  onCancel: () => void;
  /** Take focus when it opens: the form's first control, or the note in its place. */
  autoFocus?: boolean;
}

/** Free has no connections other plugins provide. */
export function CompanionConnectionEditor(_props: CompanionConnectionEditorProps): ReactNode {
  return null;
}

/** The connection types a companion brought a form for. None in Free. */
export function companionConnectionEditorTypes(): string[] {
  return [];
}

/** The settings tab where a connection type's failures are fixed. None in Free. */
export function connectionSettingsTab(_type: string): CompanionSettingsTab | undefined {
  return undefined;
}

/** What the compose route does with a companion's email, or when it gives up. */
export interface ComposeSourceHandlers {
  open: (source: { subject: string; html: string }) => void;
  /**
   * Cancel, Close or Escape. `hadFocus` is true when the card held keyboard
   * focus, which would fall to the top of the page as it goes: put it
   * somewhere first. Focus the person put elsewhere stays there.
   */
  dismiss: (hadFocus: boolean) => void;
  /**
   * Reloads the page when the companion's bundle did not load. Without it the
   * page reloads as it is, which is right only while its address still holds
   * the link.
   */
  reload?: () => void;
  /**
   * Hears when the wait for the companion starts and ends, a retry's
   * included, so a screen can keep what is under it still meanwhile.
   */
  onWaiting?: (waiting: boolean) => void;
}

/** The companion and its own value, from `#/compose?source=<id>&ref=<ref>`. */
export interface ComposeSourceParams {
  id: string;
  ref: string;
}

/** The source a compose route's search names, or null. Free reads none. */
export function composeSourceParams(_search: string): ComposeSourceParams | null {
  return null;
}

/**
 * For `#/compose?source=<id>&ref=<ref>` on a phone: asks the companion for
 * the email and hands it to `open`. Returns what to show meanwhile, or null
 * when the route names no source.
 */
export function useComposeSource(
  _search: string,
  _handlers: ComposeSourceHandlers,
): ReactNode {
  return null;
}

/**
 * The same on desktop, shown over the mailbox the compose route moves on to.
 * Renders inside PaneComposeProvider; `enabled` is false in the compact shell,
 * whose compose screen shows its own.
 */
export function CompanionComposeSourceHost(_props: { enabled: boolean }): ReactNode {
  return null;
}
