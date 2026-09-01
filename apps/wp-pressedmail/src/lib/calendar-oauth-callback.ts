/**
 * Sync-provider OAuth popup callback forwarder (calendar + contacts).
 *
 * The calendar/contacts OAuth redirect_uri points back at the plugin admin page
 * (admin.php?page=pressedmail-plugin&callback=calendar_sync|contacts_sync&provider=<p>&code=<c>).
 * When the SPA boots inside that popup it must hand the authorization code to
 * the window that opened it and close, rather than rendering the full app.
 *
 * Call maybeForwardCalendarOAuthCallback() as early as possible in the app
 * entry; it returns true when it handled a callback (the caller should then skip
 * mounting the app).
 */
export const CALENDAR_OAUTH_MESSAGE_TYPE = "pressedmail_calendar_oauth";
export const CONTACTS_OAUTH_MESSAGE_TYPE = "pressedmail_contacts_oauth";

const CALLBACK_MESSAGE_TYPES: Record<string, string> = {
  calendar_sync: CALENDAR_OAUTH_MESSAGE_TYPE,
  contacts_sync: CONTACTS_OAUTH_MESSAGE_TYPE,
};

export interface SyncOAuthCallbackMessage {
  type: string;
  provider: string;
  code: string | null;
  error: string | null;
}

/** @deprecated Use SyncOAuthCallbackMessage. */
export type CalendarOAuthCallbackMessage = SyncOAuthCallbackMessage;
/** @deprecated Use SyncOAuthCallbackMessage. */
export type ContactsOAuthCallbackMessage = SyncOAuthCallbackMessage;

export function maybeForwardCalendarOAuthCallback(): boolean {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  const callback = params.get("callback") ?? "";
  const messageType = CALLBACK_MESSAGE_TYPES[callback];
  if (!messageType) {
    return false;
  }

  const message: SyncOAuthCallbackMessage = {
    type: messageType,
    provider: params.get("provider") ?? "",
    code: params.get("code"),
    error: params.get("error"),
  };

  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(message, window.location.origin);
      window.close();
      return true;
    }
  } catch {
    // Cross-origin opener access can throw; fall through and let the app render
    // so the user is not stranded on a blank popup.
  }

  return false;
}
