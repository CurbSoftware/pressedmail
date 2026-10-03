import { __, sprintf } from "@wordpress/i18n";

import type {
  SmtpErrorClass,
  WpMailConnectionHealth,
} from "@/lib/wp-mail-api";

/**
 * The words for a failing system SMTP connection.
 *
 * These are the same sentences the server writes into the sticky notification,
 * the admin notice and Site Health (SmtpConnectionHealth::copy() in PHP), so an
 * administrator reads one message wherever they meet the problem.
 * smtp-health-copy.test.ts pins every string here and checks each one is still
 * present in that PHP file, so the two cannot drift apart unnoticed.
 *
 * Every sentence is true whether the site has one connection or several, so this
 * module ships in both editions as it is. Words that only make sense with a
 * choice of connections live in smtp-pro-copy.pro.ts, which Free replaces with
 * an empty twin.
 *
 * The two-placeholder sentences use ordered %1$s and %2$s, as translators
 * expect.
 */

/**
 * The sentence for a failing connection.
 *
 * @param errorClass What it is failing at.
 * @param label      The connection's name.
 * @param detail     The host for `connection`, the refused address for `sender`.
 *                   Without one those two fall back to the general sentence
 *                   rather than print a blank.
 */
export function smtpHealthCopy(
  errorClass: SmtpErrorClass | "" | undefined,
  label: string,
  detail = "",
): string {
  switch (errorClass) {
    case "authentication":
      return sprintf(
        /* translators: %s: SMTP connection name. */
        __(
          'SMTP connection "%s" is no longer authenticating. Update its credentials or check its settings.',
          "pressedmail",
        ),
        label,
      );
    case "tls":
      return sprintf(
        /* translators: %s: SMTP connection name. */
        __(
          'SMTP connection "%s" could not start a secure connection. Check its encryption setting.',
          "pressedmail",
        ),
        label,
      );
    case "throttled":
      return sprintf(
        /* translators: %s: SMTP connection name. */
        __(
          'SMTP connection "%s" is being rate limited by its server. Wait a while, or check its sending limits.',
          "pressedmail",
        ),
        label,
      );
    case "connection":
      if (detail !== "") {
        return sprintf(
          /* translators: 1: SMTP connection name, 2: SMTP server host. */
          __(
            'SMTP connection "%1$s" cannot reach %2$s. Check the host, port and encryption.',
            "pressedmail",
          ),
          label,
          detail,
        );
      }
      break;
    case "sender":
      if (detail !== "") {
        return sprintf(
          /* translators: 1: SMTP connection name, 2: email address the server refused. */
          __(
            'SMTP connection "%1$s" refused the sender address %2$s. Use an address this server allows.',
            "pressedmail",
          ),
          label,
          detail,
        );
      }
      break;
    default:
      break;
  }

  return sprintf(
    /* translators: %s: SMTP connection name. */
    __(
      'SMTP connection "%s" is failing to send. Check its details.',
      "pressedmail",
    ),
    label,
  );
}

/** A MySQL UTC timestamp as a local date and time, or "" when it is not one. */
export function formatHealthTime(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return "";
  }

  const date = new Date(`${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/**
 * "Last worked {time}. Last failed {time}." for a connection card.
 *
 * Each half appears only when there is a time to give it. A connection with
 * neither has never sent mail or failed to, and says so instead of printing
 * two empty sentences.
 */
export function healthTimesLine(
  health: Pick<
    WpMailConnectionHealth,
    "lastSuccessAt" | "lastFailureAt"
  > | undefined,
): string {
  const worked = formatHealthTime(health?.lastSuccessAt ?? "");
  const failed = formatHealthTime(health?.lastFailureAt ?? "");
  const parts: string[] = [];

  if (worked !== "") {
    parts.push(
      sprintf(
        /* translators: %s: date and time. */
        __("Last worked %s.", "pressedmail"),
        worked,
      ),
    );
  }
  if (failed !== "") {
    parts.push(
      sprintf(
        /* translators: %s: date and time. */
        __("Last failed %s.", "pressedmail"),
        failed,
      ),
    );
  }

  return parts.length > 0
    ? parts.join(" ")
    : __("No mail has gone through it yet.", "pressedmail");
}
