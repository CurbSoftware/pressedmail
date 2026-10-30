import { __ } from "@wordpress/i18n";

export type ShortcutGroup = "navigation" | "triage";

/**
 * What each action is called and which card it sits on. The server sends an
 * English description with every binding; people read these instead, in
 * their own language. An action the server sends that is not here is not
 * shown, so a new server action cannot appear unlabelled.
 */
export function shortcutCatalog(): Record<
  string,
  { label: string; group: ShortcutGroup }
> {
  return {
    next_email: { label: __("Next message", "pressedmail"), group: "navigation" },
    prev_email: { label: __("Previous message", "pressedmail"), group: "navigation" },
    open_email: { label: __("Open the selected message", "pressedmail"), group: "navigation" },
    back_to_list: { label: __("Back to the message list", "pressedmail"), group: "navigation" },
    go_inbox: { label: __("Go to Inbox", "pressedmail"), group: "navigation" },
    go_starred: { label: __("Go to Starred", "pressedmail"), group: "navigation" },
    go_sent: { label: __("Go to Sent", "pressedmail"), group: "navigation" },
    go_drafts: { label: __("Go to Drafts", "pressedmail"), group: "navigation" },
    search: { label: __("Search mail", "pressedmail"), group: "navigation" },
    compose: { label: __("Write a new email", "pressedmail"), group: "triage" },
    reply: { label: __("Reply", "pressedmail"), group: "triage" },
    reply_all: { label: __("Reply all", "pressedmail"), group: "triage" },
    forward: { label: __("Forward", "pressedmail"), group: "triage" },
    archive: { label: __("Archive", "pressedmail"), group: "triage" },
    delete: { label: __("Delete", "pressedmail"), group: "triage" },
    star: { label: __("Star or unstar", "pressedmail"), group: "triage" },
    mark_read: { label: __("Mark as read", "pressedmail"), group: "triage" },
    mark_unread: { label: __("Mark as unread", "pressedmail"), group: "triage" },
    snooze: { label: __("Snooze", "pressedmail"), group: "triage" },
  };
}

/** The one fixed key: it opens the list of all the others. */
export const CHEATSHEET_KEY = "?";
