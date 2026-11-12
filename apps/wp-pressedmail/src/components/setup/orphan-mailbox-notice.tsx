import { useEffect, useState } from "react";
import { __, sprintf } from "@wordpress/i18n";
import { Loader2, Trash2 } from "lucide-react";

import { Alert, AlertDescription, Button, Dialog } from "@kit/ui/plugin";
import {
  PressedDialogContent,
  PressedDialogHeader,
  PressedOverlayBody,
  PressedOverlayFooter,
} from "@/components/ui/pressed-overlay";
import { apiJson } from "@/lib/api-client";
import { getPluginRestBase } from "@/lib/runtime-config";

/** A row of GET /accounts/orphans. `email` is shown when the server sends it. */
interface OrphanMailbox {
  id: number;
  user_id: number;
  email?: string;
}

/**
 * Lets an administrator remove a mailbox whose WordPress user was deleted or
 * removed from the site.
 *
 * The Free edition has one mailbox slot. A mailbox left behind by a user who
 * is gone keeps it, and nobody can disconnect it from their own account list,
 * because it is in nobody's. The server refuses both routes to everyone but an
 * administrator, so this asks only for one.
 */
export function OrphanMailboxNotice({ onRemoved }: { onRemoved?: () => void }) {
  // PHP's `manage_options`.
  const isAdministrator = Boolean(window.pressedmailPlugin?.canManageWpMail);
  const [orphans, setOrphans] = useState<OrphanMailbox[]>([]);
  const [target, setTarget] = useState<OrphanMailbox | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdministrator) return;
    let live = true;
    // ponytail: first page only (50). Free holds one mailbox; follow
    // `next_after` if this is ever mounted where there can be more.
    apiJson<{ data?: { accounts?: OrphanMailbox[] } }>(
      `${getPluginRestBase()}accounts/orphans`,
    )
      .then((body) => {
        if (live) setOrphans(body.data?.accounts ?? []);
      })
      .catch(() => {
        // Nothing to offer when the list cannot be read.
      });
    return () => {
      live = false;
    };
  }, [isAdministrator]);

  if (!isAdministrator || orphans.length === 0) return null;

  const remove = async () => {
    if (!target) return;
    setRemoving(true);
    setError(null);
    try {
      // The server takes the exact mailbox and the owner it was listed with,
      // as integers, and refuses if either changed since the list was read.
      await apiJson(`${getPluginRestBase()}accounts/purge-orphan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: target.id,
          expected_user_id: target.user_id,
          confirmed: true,
        }),
      });
      setOrphans((current) => current.filter((item) => item.id !== target.id));
      setTarget(null);
      onRemoved?.();
    } catch (failure) {
      setError(
        failure instanceof Error && failure.message.trim() !== ""
          ? failure.message
          : __("The mailbox could not be removed. Try again.", "pressedmail"),
      );
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      {orphans.map((orphan) => (
        <Alert
          key={orphan.id}
          data-test="orphan-mailbox"
          data-testid="orphan-mailbox">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <AlertDescription className="min-w-0 grow basis-56 break-words">
              {orphan.email
                ? sprintf(
                    /* translators: %s: an email address. */
                    __(
                      "The mailbox %s was connected by a WordPress user who is no longer on this site. It still takes this site's mailbox slot.",
                      "pressedmail",
                    ),
                    orphan.email,
                  )
                : __(
                    "A mailbox was connected by a WordPress user who is no longer on this site. It still takes this site's mailbox slot.",
                    "pressedmail",
                  )}
            </AlertDescription>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setError(null);
                setTarget(orphan);
              }}
              data-test="orphan-mailbox-remove"
              data-testid="orphan-mailbox-remove">
              {__("Remove this mailbox", "pressedmail")}
            </Button>
          </div>
        </Alert>
      ))}

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !removing) setTarget(null);
        }}>
        <PressedDialogContent
          size="confirmation"
          data-test="orphan-mailbox-dialog"
          data-testid="orphan-mailbox-dialog">
          <PressedDialogHeader
            title={__("Remove this mailbox", "pressedmail")}
            icon={Trash2}
            tone="destructive"
            description={
              target?.email
                ? sprintf(
                    /* translators: %s: an email address. */
                    __(
                      "This deletes the connection for %s and everything PressedMail stored for it on this site, including its copies of mail. Mail on the mail server is not touched. This cannot be undone.",
                      "pressedmail",
                    ),
                    target.email,
                  )
                : __(
                    "This deletes the mailbox connection and everything PressedMail stored for it on this site, including its copies of mail. Mail on the mail server is not touched. This cannot be undone.",
                    "pressedmail",
                  )
            }
          />
          {error ? (
            <PressedOverlayBody>
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </PressedOverlayBody>
          ) : null}
          <PressedOverlayFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTarget(null)}
              disabled={removing}>
              {__("Cancel", "pressedmail")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={remove}
              disabled={removing}
              data-test="orphan-mailbox-confirm"
              data-testid="orphan-mailbox-confirm">
              {removing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {__("Remove this mailbox", "pressedmail")}
            </Button>
          </PressedOverlayFooter>
        </PressedDialogContent>
      </Dialog>
    </>
  );
}
