import type { ReactNode } from "react";
import { __ } from "@wordpress/i18n";

/**
 * What losing access does, one short line per thing, in one place so the Roles
 * and Users tabs say the same thing in the confirmation they both show. Each
 * line reads on its own, after whatever sentence came before it.
 */
export function accessLossEffects(): string[] {
  return [
    __(
      "Mailbox sync and scheduled emails wait, then go out late once you allow access again.",
      "pressedmail",
    ),
    __(
      "Rules, auto-replies, API keys, webhooks and bulk actions stop.",
      "pressedmail",
    ),
    __("Anything they share is hidden.", "pressedmail"),
    __("Notifications they miss are not kept.", "pressedmail"),
  ];
}

interface AccessStagedNoticeProps {
  /** Whether there is anything to say. When there is not, nothing shows. */
  show: boolean;
  children: ReactNode;
  dataTest: string;
  /**
   * Keep the words for a screen reader and draw nothing. The Users tab does
   * this: a banner that appears above the list pushes the row the admin just
   * pressed out from under the pointer, so its summary is spoken and the rows
   * themselves show what is waiting.
   */
  silent?: boolean;
}

/**
 * The note that goes with a change waiting for Save, and the announcement of it
 * for a screen reader.
 *
 * It is one element that stays in the page whether or not it has anything to
 * say, and only its content and look change. A live region that is created
 * along with its message is often not announced at all, so the region has to
 * exist first. With nothing to say it is visually hidden, not removed.
 */
export function AccessStagedNotice({
  show,
  children,
  dataTest,
  silent = false,
}: AccessStagedNoticeProps) {
  return (
    <div
      role="status"
      data-test={dataTest}
      data-testid={dataTest}
      className={
        show && !silent
          ? "space-y-1 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs"
          : "sr-only"
      }>
      {show ? children : null}
    </div>
  );
}
