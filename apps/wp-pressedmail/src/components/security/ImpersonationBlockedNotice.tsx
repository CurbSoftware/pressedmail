import { __ } from "@wordpress/i18n";
import { ShieldAlert } from "lucide-react";

interface ImpersonationBlockedNoticeProps {
  message: string;
  reason?: string | null;
}

/**
 * Full-surface graceful notice shown when the current user context is security
 * blocked (admin user-switching / impersonation). It deliberately renders NO
 * mailbox chrome, no folder list, no message list, because every IMAP-backed
 * request would fail. It replaces the 403/404/500 cascade with one clear,
 * actionable message.
 */
export function ImpersonationBlockedNotice({
  message,
  reason,
}: ImpersonationBlockedNoticeProps) {
  return (
    <div
      data-test="impersonation-blocked-notice"
      data-testid="impersonation-blocked-notice"
      data-pm-impersonation-reason={reason ?? undefined}
      className="flex min-h-screen w-full items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/10 text-warning">
          <ShieldAlert className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          {__("Mailbox access paused", "pressedmail")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {message}
        </p>
        <p className="text-xs text-muted-foreground/80">
          {__(
            "This keeps connected email accounts from being opened through a switched session. Sign in with your own account to read your email.",
            "pressedmail",
          )}
        </p>
      </div>
    </div>
  );
}

export default ImpersonationBlockedNotice;
