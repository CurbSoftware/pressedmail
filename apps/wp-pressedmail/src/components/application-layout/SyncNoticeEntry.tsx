"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { Clock3, RefreshCw } from "lucide-react";

import { Button } from "@kit/ui/plugin";
import { cn } from "@/lib/utils";
import type { SyncDelayedKind } from "@/services/interfaces/connection-state.interface";

/**
 * Reload the whole page.
 *
 * A late sync means this tab is doing the sync itself. Reloading restarts that work from a
 * clean state, which is the one thing a reader can usefully do about it. Isolated here so a
 * test can stub one thing rather than the global.
 */
function reloadPage(): void {
  window.location.reload();
}

/** What the entry is called, in the list, to a screen reader and on the bell. */
export function syncNoticeTitle(): string {
  return __("Sync is running late", "pressedmail");
}

function syncNoticeBody(kind: SyncDelayedKind): string {
  switch (kind) {
    case "slow":
      return __(
        "Your server is taking a long time to answer. Sync still runs, just slower. Reload if mail looks stale.",
        "pressedmail",
      );
    case "busy":
      return __(
        "Your server asked PressedMail to slow down. Sync is waiting between requests. Reload if mail looks stale.",
        "pressedmail",
      );
    default:
      return __(
        "Your server is slow to run background sync, so PressedMail is syncing in this tab. Reload if mail looks stale.",
        "pressedmail",
      );
  }
}

/**
 * The "sync is running late" entry at the top of the notifications panel, in the popover and
 * in the phone's sheet. It wears the same face as a feed row: the disc, a headline, a line of
 * plain words under it. It is info, so the disc is the quiet one a read row has, with the clock
 * a scheduled row wears (it is late, and Reload carries the sync arrows).
 *
 * It is not a feed row. The server knows nothing about it, it has no time or unread state,
 * and the actions it offers are Reload, the one thing worth doing, and Dismiss, which hides
 * it until the condition clears and comes back. Both are plain buttons in the tab order:
 * the entry sits outside the feed's arrow-key group, so it never takes the list's one tab stop.
 */
export function SyncNoticeEntry({
  kind,
  surface,
  touch,
  onDismiss,
  onFocusLost,
}: {
  kind: SyncDelayedKind;
  /** The panel's ground colour, so the entry sits on the same surface as its rows. */
  surface: string;
  /** A thumb-sized target on the phone's sheet. */
  touch?: string;
  onDismiss: () => void;
  /**
   * Called as the entry goes while focus is on one of its buttons: it was dismissed, or the condition cleared
   * under a keyboard reader. Without it focus would fall to the page. It runs before the buttons leave, so the
   * panel can move focus to a place that stays.
   */
  onFocusLost: () => void;
}) {
  const titleId = React.useId();
  const bodyId = React.useId();
  const root = React.useRef<HTMLUListElement>(null);
  const handOff = React.useRef(onFocusLost);
  handOff.current = onFocusLost;
  React.useLayoutEffect(
    () => () => {
      if (root.current?.contains(document.activeElement)) handOff.current();
    },
    [],
  );

  return (
    <ul ref={root}>
      <li
        data-test="sync-delayed-chip"
        data-severity="info"
        className={cn("border-b", surface)}>
        <div className="flex items-start gap-2.5 px-4 py-2.5">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Clock3 className="size-4" aria-hidden="true" />
          </span>
          {/* A group, so a reader who tabs in from the toolbar hears what Reload and Dismiss belong to. */}
          <div
            role="group"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            className="min-w-0 flex-1">
            <p id={titleId} className="text-sm font-medium">
              {syncNoticeTitle()}
            </p>
            <p
              id={bodyId}
              className="mt-0.5 text-xs text-muted-foreground">
              {syncNoticeBody(kind)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                data-test="sync-delayed-reload"
                className={cn("gap-1.5", touch)}
                onClick={reloadPage}>
                <RefreshCw className="size-3.5" aria-hidden="true" />
                {__("Reload", "pressedmail")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={cn("text-muted-foreground hover:text-foreground", touch)}
                onClick={onDismiss}>
                {__("Dismiss", "pressedmail")}
              </Button>
            </div>
          </div>
        </div>
      </li>
    </ul>
  );
}
