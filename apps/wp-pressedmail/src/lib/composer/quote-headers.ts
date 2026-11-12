import { __, sprintf } from "@wordpress/i18n";

/**
 * The two lines that introduce quoted mail, in the user's language.
 *
 * compose-utils writes them and plain-text-content finds the quoted original
 * by them, to place the signature and to tell an empty reply from a written
 * one. Both read the translation here, so a translator cannot move one side
 * without the other. Kept free of the editor so the inbox can import it.
 */

/** The line above a quoted reply. */
export function replyQuoteHeader(date: string, sender: string): string {
  return sprintf(
    /* translators: The line above a quoted reply. 1: date and time the quoted message arrived, 2: who sent it. */
    __("On %1$s, %2$s wrote:", "pressedmail"),
    date,
    sender,
  );
}

/** The line that opens a forwarded message. */
export function forwardedMessageHeader(): string {
  return `---------- ${__("Forwarded message", "pressedmail")} ---------`;
}
