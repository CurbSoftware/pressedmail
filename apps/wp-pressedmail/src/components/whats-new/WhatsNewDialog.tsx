import * as React from "react";
import { __, sprintf } from "@wordpress/i18n";
import { BookOpen, Sparkles } from "lucide-react";

import { Button, Dialog } from "@kit/ui/plugin";
import {
  PressedDialogContent,
  PressedDialogHeader,
  PressedOverlayBody,
  PressedOverlayFooter,
} from "@/components/ui/pressed-overlay";
import { DOCS_BASE_URL } from "@/components/settings-ui";
import { compareVersions, pickWhatsNewRelease } from "@/config/whats-new";
import { useUserPreferences } from "@/hooks/useUserPreferences";

/**
 * The version the running plugin reports. Empty when the page did not localize
 * one, in which case there is nothing to compare and nothing is shown.
 */
function runningVersion(): string {
  const version =
    typeof window === "undefined" ? "" : window.pressedmailPlugin?.version;
  return typeof version === "string" ? version : "";
}

/**
 * A short list of what is new, shown once per person after an install or an
 * update that has something to show.
 *
 * It is a plain dialog: closing it any way (button, X, Escape, a click outside)
 * counts as seen, and the version is stored on the person's preferences so it
 * does not return on another browser or device. Content is bundled with the
 * plugin and nothing is fetched, so it works offline and sends nothing. The
 * only link leaves for the documentation, in a new tab, when clicked.
 *
 * Mount it only once setup is complete, so a fresh install sees the setup
 * wizard first and this afterwards.
 */
export function WhatsNewDialog() {
  const { preferences, loaded, updatePreference } = useUserPreferences();
  // Closed for this page load no matter how the save goes, so a failed write
  // cannot bring the dialog back on the next render.
  const [closed, setClosed] = React.useState(false);

  const running = runningVersion();
  const release = React.useMemo(
    () => (running === "" ? null : pickWhatsNewRelease(running)),
    [running],
  );

  // A preferences payload from an older build has no such key.
  const seen = preferences.whats_new_seen_version ?? "";
  const open =
    loaded &&
    !closed &&
    release !== null &&
    release.items.length > 0 &&
    (seen === "" || compareVersions(release.version, seen) > 0);

  if (!open || release === null) return null;

  const close = (): void => {
    setClosed(true);
    void updatePreference("whats_new_seen_version", release.version);
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) close();
      }}>
      <PressedDialogContent
        size="confirmation"
        data-test="whats-new-dialog"
        data-testid="whats-new-dialog">
        <PressedDialogHeader
          icon={Sparkles}
          title={__("What's new", "pressedmail")}
          description={sprintf(
            /* translators: %s: a version number such as 1.7.1. */
            __("Highlights from version %s", "pressedmail"),
            release.version,
          )}
        />
        <PressedOverlayBody>
          <ul className="space-y-4">
            {release.items.map((item) => (
              <li key={item.id}>
                <p className="text-sm font-medium text-foreground">
                  {item.title}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </PressedOverlayBody>
        <PressedOverlayFooter className="sm:items-center sm:justify-between">
          <a
            href={DOCS_BASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="pm-focus-pill inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <BookOpen className="size-3.5" aria-hidden="true" />
            {__("Read the docs", "pressedmail")}
            <span className="sr-only">
              {__("(opens in a new tab)", "pressedmail")}
            </span>
          </a>
          <Button autoFocus onClick={close}>
            {__("Got it", "pressedmail")}
          </Button>
        </PressedOverlayFooter>
      </PressedDialogContent>
    </Dialog>
  );
}

export default WhatsNewDialog;
