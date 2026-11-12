import { __ } from "@wordpress/i18n";

import {
  StatusPill,
  type StatusTone,
} from "@/components/ui/status-pill";
import type { SmtpHealthState, WpMailConnectionHealth } from "@/lib/wp-mail-api";

const TONE: Record<SmtpHealthState, StatusTone> = {
  ok: "pass",
  attention: "fail",
  untested: "info",
};

function label(state: SmtpHealthState): string {
  switch (state) {
    case "ok":
      return __("Working", "pressedmail");
    case "attention":
      return __("Needs attention", "pressedmail");
    default:
      return __("Not tested", "pressedmail");
  }
}

/**
 * A connection a service has only taken mail for: it works as far as anyone
 * knows, but no message is known to have gone out. "Working" would claim that.
 */
export function onlyHandedOver(
  health: Partial<Pick<WpMailConnectionHealth, "state" | "lastSuccessAt" | "lastHandoverAt">> | undefined,
): boolean {
  return health?.state === "ok" && !health.lastSuccessAt && Boolean(health.lastHandoverAt);
}

export interface SmtpHealthBadgeProps {
  /** A connection's health view. Renders nothing without one. */
  health?: Pick<WpMailConnectionHealth, "state"> &
    Partial<Pick<WpMailConnectionHealth, "lastSuccessAt" | "lastHandoverAt">>;
  /** The state to show when only that is known, such as on a system email row. */
  state?: SmtpHealthState;
  className?: string;
  "data-test"?: string;
  "data-testid"?: string;
}

/**
 * Whether an SMTP connection works, in a pill.
 *
 * Built on StatusPill, so the state is an icon and a word and never a colour on
 * its own, and every tone resolves to a theme token.
 */
export function SmtpHealthBadge({
  health,
  state,
  className,
  "data-test": dataTest,
  "data-testid": dataTestId,
}: SmtpHealthBadgeProps) {
  const shown = state ?? health?.state;
  if (!shown) {
    return null;
  }

  if (!state && onlyHandedOver(health)) {
    return (
      <StatusPill
        tone="info"
        label={__("Taking mail", "pressedmail")}
        className={className}
        data-test={dataTest}
        data-testid={dataTestId}
      />
    );
  }

  return (
    <StatusPill
      tone={TONE[shown]}
      label={label(shown)}
      className={className}
      data-test={dataTest}
      data-testid={dataTestId}
    />
  );
}
