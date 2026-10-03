import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { __ } from "@wordpress/i18n";

import { Badge, cn } from "@kit/ui/plugin";

/**
 * One status vocabulary for the whole plugin.
 *
 * Pass / Info / Warning / Fail were previously spelled out inline wherever a
 * check reported a result, the phishing report carried its own four-branch
 * `statusMeta()`, and other surfaces reached for raw palette classes. Both
 * drift, and raw palette classes do not follow the active theme's `statusHues`.
 *
 * Every tone here resolves to a theme token, so all ten schemes track.
 */
export type StatusTone = "pass" | "info" | "warning" | "fail";

const TONE_ICON: Record<StatusTone, LucideIcon> = {
  pass: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  fail: XCircle,
};

/** Tinted surface + matching text, mirroring Badge's own success/warning tones. */
const TONE_CLASS: Record<StatusTone, string> = {
  pass: "border-success/30 bg-success/10 text-success",
  info: "border-border bg-muted text-muted-foreground",
  warning: "border-warning/30 bg-warning/10 text-warning",
  fail: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function statusToneLabel(tone: StatusTone): string {
  switch (tone) {
    case "fail":
      return __("Fail", "pressedmail");
    case "warning":
      return __("Warning", "pressedmail");
    case "info":
      return __("Info", "pressedmail");
    default:
      return __("Pass", "pressedmail");
  }
}

export interface StatusPillProps {
  tone: StatusTone;
  /** Defaults to the translated tone name. */
  label?: string;
  /** Hide the leading icon when the row already carries one. */
  hideIcon?: boolean;
  className?: string;
  /** Callers keep their own hook; defaults to "status-pill". */
  "data-test"?: string;
  "data-testid"?: string;
}

export function StatusPill({
  tone,
  label,
  hideIcon = false,
  className,
  "data-test": dataTest = "status-pill",
  "data-testid": dataTestId,
}: StatusPillProps) {
  const Icon = TONE_ICON[tone];
  const text = label ?? statusToneLabel(tone);

  return (
    <Badge
      variant="outline"
      data-test={dataTest}
      data-testid={dataTestId}
      data-tone={tone}
      className={cn("shrink-0 gap-1", TONE_CLASS[tone], className)}>
      {hideIcon ? null : <Icon aria-hidden="true" />}
      {text}
    </Badge>
  );
}

/** A bare tone dot, for dense rows where a full pill is too heavy. */
export function StatusDot({
  tone,
  className,
}: {
  tone: StatusTone;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-test="status-dot"
      data-tone={tone}
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        tone === "pass" && "bg-success",
        tone === "info" && "bg-muted-foreground",
        tone === "warning" && "bg-warning",
        tone === "fail" && "bg-destructive",
        className,
      )}
    />
  );
}
