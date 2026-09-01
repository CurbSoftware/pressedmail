import { useState } from "react";
import { __ } from "@wordpress/i18n";
import { Lock, Loader2 } from "lucide-react";

import { Button } from "@kit/ui/plugin";

import { apiFetch } from "@/lib/api-client";
import {
  setMailboxLockStatus,
  type MailboxLockRuntimeStatus,
} from "@/lib/mailbox-lock";
import { getRuntimeRestNamespace } from "@/lib/runtime-config";

const getApiUrl = (): string =>
  (window as unknown as { pressedmailPlugin?: { apiUrl?: string } })
    .pressedmailPlugin?.apiUrl || "";

/**
 * One-time notice for users who had the removed "require account verification
 * after logout" option enabled. Their mail stays accessible; this explains the
 * replacement (PressedMail Lock) and where to enable it. Dismissing calls the
 * migration-ack endpoint so the prompt never reappears on any device.
 */
export function LockMigrationPrompt() {
  const [dismissing, setDismissing] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (hidden) {
    return null;
  }

  const dismiss = async () => {
    setDismissing(true);
    try {
      const res = await apiFetch(
        `${getApiUrl()}${getRuntimeRestNamespace()}/security/lock/migration-ack`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => null)) as {
        lock?: MailboxLockRuntimeStatus;
      } | null;
      setMailboxLockStatus(data?.lock);
    } catch {
      // Hide locally regardless; the server flag re-surfaces it next boot if
      // the acknowledgement did not persist.
    } finally {
      setHidden(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
      data-test="lock-migration-prompt"
      data-testid="lock-migration-prompt">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lock-migration-title"
        className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 id="lock-migration-title" className="text-lg font-semibold">
            {__("A simpler way to protect your mailbox", "pressedmail")}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {__(
            "The “require account verification after logout” option was replaced by PressedMail Lock: one optional passphrase that locks your mailbox on logout, after inactivity, or on demand, without re-entering every account password.",
            "pressedmail",
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          {__(
            "Your mail stays accessible until you set it up. Enable it any time under Settings → Security.",
            "pressedmail",
          )}
        </p>
        {/* The only control in a blocking overlay, so it takes focus on mount:
            without it a keyboard user is left behind the prompt. */}
        <Button
          autoFocus
          className="w-full"
          onClick={() => void dismiss()}
          disabled={dismissing}>
          {dismissing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {__("Got it", "pressedmail")}
        </Button>
      </div>
    </div>
  );
}

export default LockMigrationPrompt;
