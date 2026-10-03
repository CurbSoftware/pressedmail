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

export interface SmtpHealthBadgeProps {
  /** A connection's health view. Renders nothing without one. */
  health?: Pick<WpMailConnectionHealth, "state">;
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
