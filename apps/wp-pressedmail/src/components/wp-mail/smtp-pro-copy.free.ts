/**
 * Free twin of smtp-pro-copy.pro.ts. Free holds one SMTP connection, so there
 * is no default to fall back to and no sender two connections can dispute:
 * nothing here has anything to say, and none of Pro's sentences ship with it.
 */

export type SystemEmailAttentionReason =
  | "missing"
  | "disabled"
  | "incomplete"
  | "attention";

/** Free has no per-email connection choice, so there is nothing to warn about. */
export function systemEmailAttentionCopy(
  reason: SystemEmailAttentionReason,
  label: string,
  errorClass?: string,
  detail?: string,
): string {
  void reason;
  void label;
  void errorClass;
  void detail;
  return "";
}

/** Free never records a route only several connections can produce. */
export function proRouteLabel(route: string | undefined): string {
  void route;
  return "";
}
