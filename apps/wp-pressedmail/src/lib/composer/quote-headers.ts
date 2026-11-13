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

/**
 * Marks quoted mail in the HTML a reply or forward opens with: "header" on the
 * line above the quote, "body" on the blockquote. The editor keeps it on the
 * node (plate/quoted-plugin.ts) and writes it back out, and the send-time
 * scrub reads it (TemplateVariables::history_spans), so a quote is known for
 * one in every language.
 */
export const QUOTED_ATTRIBUTE = "data-pm-quoted";
