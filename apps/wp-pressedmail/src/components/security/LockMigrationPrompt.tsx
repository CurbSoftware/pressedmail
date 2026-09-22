import { useState } from "react";
import { __ } from "@wordpress/i18n";
import { Lock, Loader2 } from "lucide-react";

import { AlertDialog, Button } from "@kit/ui/plugin";
import {
  PressedAlertDialogContent,
  PressedAlertDialogHeader,
  PressedOverlayBody,
  PressedOverlayFooter,
} from "@/components/ui/pressed-overlay";

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

  // Not dismissable: no overlay click, no Escape. The only way out is "Got it",
  // which records the acknowledgement so the prompt stays gone on every device.
  return (
    <AlertDialog open>
      <PressedAlertDialogContent
        size="confirmation"
        data-test="lock-migration-prompt"
        data-testid="lock-migration-prompt"
        onEscapeKeyDown={(event) => event.preventDefault()}>
        <PressedAlertDialogHeader
          icon={Lock}
          title={__("A simpler way to protect your mailbox", "pressedmail")}
        />
        <PressedOverlayBody className="space-y-4">
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
        </PressedOverlayBody>
        <PressedOverlayFooter>
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
        </PressedOverlayFooter>
      </PressedAlertDialogContent>
    </AlertDialog>
  );
}

export default LockMigrationPrompt;
