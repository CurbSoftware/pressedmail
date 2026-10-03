import { __ } from "@wordpress/i18n";

import type { SmtpSenderProbe, SmtpStatusMessage } from "./types";

/**
 * Outcome of a connection test, as returned by the REST endpoint.
 */
export interface WpMailTestOutcome {
  ok: boolean;
  message: string;
}

/**
 * Derive the status copy for a connection-test result.
 *
 * The case worth the extra branch is a test that succeeds while the runtime is
 * still switched off. The credentials work, but no WordPress email is going
 * through them yet, and reporting that as a plain success is how an
 * administrator walks away believing the job is done.
 *
 * A pure helper so both copy behaviours are testable without a full harness.
 */
export function buildWpMailTestStatus(
  result: WpMailTestOutcome,
  active: boolean,
): SmtpStatusMessage {
  if (!result.ok) {
    return {
      kind: "error",
      message:
        result.message || __("Test email could not be sent.", "pressedmail"),
    };
  }

  if (!active) {
    return {
      kind: "info",
      message:
        (result.message || __("Test email sent.", "pressedmail")) +
        " " +
        __(
          "WordPress email is not being routed through this server yet. Turn on “Send WordPress email through SMTP” and save.",
          "pressedmail",
        ),
    };
  }

  return {
    kind: "success",
    message: result.message || __("Test email sent.", "pressedmail"),
  };
}

/**
 * One sender address's probe verdict, as a chip and a sentence.
 *
 * Four states, and only one of them is a failure. A server that says no is the
 * owner's problem to fix; a server that says nothing useful, or cannot be
 * reached at all, has told us nothing about the address, and rendering either
 * as a failure is how someone deletes a working sender.
 *
 * `accepted` is deliberately narrow: the server accepted this address as the
 * sender for this login, which is all SMTP decides at that point. Whether the
 * message is later delivered as that address is the provider's call, and Gmail
 * for one only applies its send-as setting after the message body.
 */
export interface SmtpSenderReport {
  /** The chip's tone. "info" is a verdict that is not a pass or a failure. */
  tone: "success" | "destructive" | "info";
  label: string;
  message: string;
  /**
   * The server's own reply, in its words, or the reason it was never reached.
   * Empty for an accepted address: nothing failed, so there is nothing to
   * quote, and anything left over from an earlier command must not ride along.
   */
  detail: string;
}

export function buildSenderProbeReport(
  probe: SmtpSenderProbe,
): SmtpSenderReport {
  // The reply code and the server's own words. Neither is translatable, and a
  // code with no text beside it is still worth showing.
  const detail =
    probe.code > 0 && probe.detail
      ? `${probe.code}: ${probe.detail}`
      : probe.detail;

  switch (probe.result) {
    case "accepted":
      return {
        tone: "success",
        label: __("Accepted", "pressedmail"),
        // No pointer at the test-send button. That button sends through the
        // connection's own From address, not the address just probed, so it
        // cannot confirm this verdict and saying otherwise would be a false
        // promise. The probe is the confirmation; the caveat is the honest
        // remainder.
        message: __(
          "The server accepted this address as the sender for this login. A provider can still refuse it when the message is delivered: Gmail, for one, only applies its send-as setting after the message body.",
          "pressedmail",
        ),
        detail,
      };
    case "rejected":
      return {
        tone: "destructive",
        label: __("Rejected", "pressedmail"),
        message: __(
          "The server refused this address. Check that the mailbox this server logs in as is allowed to send as it.",
          "pressedmail",
        ),
        detail,
      };
    case "inconclusive":
      return {
        tone: "info",
        label: __("No clear answer", "pressedmail"),
        message: __(
          "The server did not answer clearly, so this address was neither accepted nor refused. Greylisting and rate limits look like this; try again in a moment.",
          "pressedmail",
        ),
        detail,
      };
    default: {
      // The server's own sentence, because this verdict covers two things the
      // client cannot tell apart: a server that was never reached, and one that
      // was reached and answered about the session (530, 538, 503, 554) rather
      // than about the address. Only the server knows which of the two it was,
      // and telling an administrator their server is unreachable when it
      // answered is how a login or security setting gets hunted for in the
      // wrong place.
      const serverSaid = probe.message.trim();
      return {
        tone: "info",
        label: __("Could not test", "pressedmail"),
        message:
          serverSaid ||
          __(
            "The server could not be reached, or it refused the login, so this address was not tested.",
            "pressedmail",
          ),
        // The same line once. A transport failure reports itself as both the
        // sentence and the detail, and a chip that repeats a line reads as two
        // separate answers.
        detail: serverSaid && serverSaid === probe.detail.trim() ? "" : detail,
      };
    }
  }
}
