"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { Bell, BellOff, Pause } from "lucide-react";

import { MobileSheet } from "@/components/mobile-shell";
import { useNotificationPause } from "@/hooks/useNotificationPause";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useNotificationFeed } from "@/layouts/shared/hooks/useNotificationFeed";
import { describePause } from "@/lib/notification-pause";

import { notificationBellName } from "./notification-bell-name";
import { NotificationsPanel } from "./NotificationsPanel";
import {
  openNotificationsSheet,
  setNotificationsSheetOpen,
  useNotificationsSheetOpen,
} from "./use-notifications-sheet";

/**
 * Settings > Preferences on the phone, opened on Alert behavior, where "Unread
 * only" and the alert scope live. Without the section it opens on the Inbox
 * category, and the reader has to find Notifications in the category list.
 */
const ALERT_SETTINGS_PATH = "/settings/preferences?subtab=alert-behavior";

/**
 * The notification feed on a phone or a portrait tablet, where the header has no
 * bell: the same panel the desktop popover holds, in a sheet that takes most of
 * the screen.
 *
 * The feed is read here, in the sheet's owner, and not in the panel: the rows are
 * already loaded when the sheet opens, as they are for the desktop popover, and
 * opening it does not start from a skeleton.
 */
export function MobileNotificationsSheet() {
  const open = useNotificationsSheetOpen();
  const feed = useNotificationFeed();
  // Whether the clear-all confirm is up over the sheet. The confirm is Radix and
  // the sheet is Base UI, and the sheet listens for Escape on the document too:
  // the press that closed the confirm closed the sheet under it. Radix has marked
  // the confirm closed by the time the sheet hears the same key, so the flag
  // stays up for the rest of that event and a close that arrives in it is not one.
  const confirming = React.useRef(false);
  const onOpenChange = React.useCallback((next: boolean) => {
    if (!next && confirming.current) return;
    setNotificationsSheetOpen(next);
  }, []);
  const onConfirmingChange = React.useCallback((next: boolean) => {
    if (next) {
      confirming.current = true;
      return;
    }
    window.setTimeout(() => {
      confirming.current = false;
    }, 0);
  }, []);
  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={__("Notifications", "pressedmail")}
      flush
      // The sheet's own `data-[side=bottom]:h-auto` outranks a plain height, so
      // the height has to be named the same way to count. A sheet with no
      // definite height cannot give the list a box to scroll in.
      //
      // From a tablet's width up it stops stretching edge to edge: a panel
      // 700px wide leaves the toolbar a long way from the words it belongs to.
      //
      // The sheet's own close button is pinned to the right. In a right to left
      // page the title starts on the right, so the two sat on top of each other:
      // the close button is the sheet's one direct child that is a button, and it
      // goes to the left there.
      className="data-[side=bottom]:h-[88dvh] sm:mx-auto sm:max-w-[34rem] sm:border-x rtl:[&>button]:left-4 rtl:[&>button]:right-auto">
      <NotificationsPanel
        {...feed}
        variant="sheet"
        alertSettingsPath={ALERT_SETTINGS_PATH}
        onNavigate={() => setNotificationsSheetOpen(false)}
        onConfirmingChange={onConfirmingChange}
      />
    </MobileSheet>
  );
}

/**
 * The bell in the phone's Inbox header. It carries the unread count the way the
 * desktop bell does, a paused glyph in its place while notifications are paused,
 * and a slash through the bell while sound and pop-ups are muted.
 */
export function MobileNotificationsButton() {
  const { unreadCount } = useNotificationFeed();
  const silence = useNotificationPause();
  const { preferences } = useUserPreferences();
  const paused = silence.paused;
  const muted = preferences.notification_muted === true;
  const name = notificationBellName({
    unreadCount,
    pausedText:
      silence.endsAt !== null ? describePause(silence.endsAt) : null,
    muted,
  });

  return (
    <button
      type="button"
      aria-label={name}
      data-test="mobile-notifications-button"
      onClick={openNotificationsSheet}
      className="pm-touch-target pm-no-tap-highlight relative inline-flex items-center justify-center rounded-full text-foreground active:bg-muted">
      {muted ? (
        <BellOff
          data-test="mobile-notifications-muted-glyph"
          className="h-5 w-5"
          aria-hidden="true"
        />
      ) : (
        <Bell className="h-5 w-5" aria-hidden="true" />
      )}
      {!paused && unreadCount > 0 ? (
        <span
          aria-hidden="true"
          data-test="mobile-notifications-badge"
          className="pointer-events-none absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
      {paused ? (
        <span
          aria-hidden="true"
          data-test="mobile-notifications-paused-glyph"
          className="pointer-events-none absolute right-0.5 top-0.5 flex size-[18px] items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground">
          <Pause className="size-2.5 fill-current" />
        </span>
      ) : null}
    </button>
  );
}
