import { __ } from "@wordpress/i18n";

import type { SmtpStatusMessage } from "./types";

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
