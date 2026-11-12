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
 * @param errorClass    What it is failing at.
 * @param label         The connection's name.
 * @param detail        The host for `connection`, the refused address for `sender`.
 *                      Without one those two fall back to the general sentence
 *                      rather than print a blank.
 * @param pluginMessage What the plugin that provides the connection said went
 *                      wrong (pluginMessageOf), which then follows the name
 *                      instead of a sentence chosen by class.
 */
export function smtpHealthCopy(
  errorClass: SmtpErrorClass | "" | undefined,
  label: string,
  detail = "",
  pluginMessage = "",
): string {
  if (pluginMessage !== "") {
    return sprintf(
      /* translators: 1: connection name, 2: what went wrong, in the words of the plugin that provides the connection. */
      __('Connection "%1$s": %2$s', "pressedmail"),
      label,
      pluginMessage,
    );
  }

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

/**
 * The providing plugin's own sentence about a failure, or "". A server's words
 * are never shown this way: only a message the server marked as the plugin's.
 */
export function pluginMessageOf(
  health: { message?: string; pluginMessage?: boolean } | undefined,
): string {
  return health?.pluginMessage ? (health.message ?? "") : "";
}

/** A MySQL UTC timestamp as a date, or null when it is not one. */
function parseHealthTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A MySQL UTC timestamp as a local date and time, or "" when it is not one. */
export function formatHealthTime(value: string): string {
  const date = parseHealthTime(value);

  return date
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date)
    : "";
}

/**
 * How long a service may take to report on mail it took before the page says
 * nothing has come. ponytail: one fixed day for every service; a per-service
 * window if a service legitimately reports slower. Only the words change, never
 * the stored status, so a late report still settles the message.
 */
const REPORT_OVERDUE_MS = 24 * 60 * 60 * 1000;

/** Whether a MySQL UTC timestamp is more than a day old. A value that is not one is not overdue. */
export function reportOverdue(value: string, now: number = Date.now()): boolean {
  const date = parseHealthTime(value);

  return date !== null && now - date.getTime() > REPORT_OVERDUE_MS;
}

/**
 * "Last worked {time}. Last failed {time}." for a connection card.
 *
 * Each half appears only when there is a time to give it. A connection a
 * service has only taken mail for says when it last did, and that nothing has
 * reported a delivery: a handover is not proof that mail went out. A day on,
 * with still no report, it says to check the service. A connection
 * with none of these has never sent mail or failed to, and says so instead of
 * printing empty sentences.
 */
export function healthTimesLine(
  health:
    | (Pick<WpMailConnectionHealth, "lastSuccessAt" | "lastFailureAt"> &
        Partial<Pick<WpMailConnectionHealth, "lastHandoverAt">>)
    | undefined,
): string {
  const worked = formatHealthTime(health?.lastSuccessAt ?? "");
  const failed = formatHealthTime(health?.lastFailureAt ?? "");
  const handedOver = worked === "" ? formatHealthTime(health?.lastHandoverAt ?? "") : "";
  const parts: string[] = [];

  if (handedOver !== "") {
    parts.push(
      sprintf(
        reportOverdue(health?.lastHandoverAt ?? "")
          ? /* translators: %s: date and time. */
            __("Mail handed over on %s. No delivery reported since, so check the service.", "pressedmail")
          : /* translators: %s: date and time. */
            __("Mail handed over on %s. No delivery reported yet.", "pressedmail"),
        handedOver,
      ),
    );
  }

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
