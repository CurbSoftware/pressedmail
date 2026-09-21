/**
 * Free build calendar/contacts sync popup forwarder.
 *
 * Both sync features are unavailable in the Free edition, so no popup can ever
 * open with `callback=calendar_sync` or `callback=contacts_sync`. `false` is
 * the honest answer: this window did not handle a sync callback, so the admin
 * app boots normally.
 *
 * The Pro forwarder keeps the message-type constants and the postMessage call;
 * they are not re-exported here because the two Pro-only settings tabs that
 * read them are chunk-excluded from the Free build.
 */
export function maybeForwardCalendarOAuthCallback(): boolean {
  return false;
}
