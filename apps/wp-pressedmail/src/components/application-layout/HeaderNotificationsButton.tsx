"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { Bell, BellOff, Pause } from "lucide-react";
import { Button, Popover, PopoverTrigger } from "@kit/ui/plugin";
import { PressedPopoverContent } from "@/components/ui/pressed-overlay";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { useNotificationPause } from "@/hooks/useNotificationPause";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import type { NotificationFeedState } from "@/layouts/shared/hooks/useNotificationFeed";
import { describePause } from "@/lib/notification-pause";

import { notificationBellName } from "./notification-bell-name";
import { NotificationsPanel } from "./NotificationsPanel";

type TooltipSide = "top" | "right" | "bottom" | "left";

export interface HeaderNotificationsButtonProps extends NotificationFeedState {
  tooltipSide?: TooltipSide;
}

/** Settings > Preferences > Alert behavior, where "Unread only" and the alert scope live. */
const ALERT_SETTINGS_PATH = "/settings?tab=preferences&subtab=alert-behavior";

/**
 * Where focus lands when the popover opens: the newest row, not the first button
 * of the toolbar. The toolbar's first button is Mark all as read, and a second
 * Enter, or a held one, would have done that. The toolbar is one Shift+Tab away.
 * With no rows to land on yet, the popover itself takes focus, so a screen reader
 * is inside it and Tab starts from its top.
 */
function focusFirstRow(event: Event) {
  event.preventDefault();
  const popover = (event.currentTarget ?? event.target) as HTMLElement | null;
  if (!popover) return;
  const row = popover.querySelector<HTMLElement>(
    "[data-notification-id] [data-roving-item]",
  );
  (row ?? popover).focus({ preventScroll: true });
}

/**
 * The Undo toast lives outside the popover, so pressing it counts as an outside
 * click and would close the panel the reader is working in. A toast is theirs to
 * use without leaving.
 */
function keepOpenForToast(event: Event) {
  const target = event.target as Element | null;
  if (target?.closest?.("[data-sonner-toast], [data-sonner-toaster]")) {
    event.preventDefault();
  }
}

/**
 * The bell, its badge, and the popover that holds the feed. Everything inside the
 * popover is `NotificationsPanel`, which the phone's sheet holds as well.
 */
export function HeaderNotificationsButton({
  tooltipSide = "bottom",
  ...feed
}: HeaderNotificationsButtonProps) {
  const silence = useNotificationPause();
  const { preferences } = useUserPreferences();
  const [open, setOpen] = React.useState(false);
  // Whether the clear-all confirm is up. It opens over the popup, and a click in
  // it or focus moving into it reads as the popup losing focus, so a close that
  // arrives while it is up is not a close.
  const confirming = React.useRef(false);
  const bell = React.useRef<HTMLButtonElement>(null);
  const titleId = React.useId();

  const { unreadCount } = feed;
  const label = __("Notifications", "pressedmail");
  const paused = silence.paused;
  // Muted keeps the list and the badge and takes away sound and pop-ups, so the
  // bell wears a slash and the badge stays.
  const muted = preferences.notification_muted === true;
  const pausedText =
    silence.endsAt !== null ? describePause(silence.endsAt) : null;
  // A paused bell is quiet: the number is held back, and a glyph says why.
  const badgeDisplay =
    !paused && unreadCount > 0
      ? unreadCount > 99
        ? "99+"
        : String(unreadCount)
      : null;
  const bellName = notificationBellName({ unreadCount, pausedText, muted });

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next && confirming.current) return;
        setOpen(next);
      }}>
      <PressedTooltip
        content={paused || muted ? bellName : label}
        side={tooltipSide}>
        <PopoverTrigger asChild>
          <Button
            ref={bell}
            variant="ghost"
            size="icon"
            type="button"
            aria-label={bellName}
            data-test="notifications-button"
            className="relative h-8 w-8 rounded-md text-muted-foreground hover:text-foreground">
            {muted ? (
              <BellOff
                data-test="notifications-muted-glyph"
                className="h-5 w-5"
                aria-hidden="true"
              />
            ) : (
              <Bell className="h-5 w-5" aria-hidden="true" />
            )}
            {badgeDisplay ? (
              <span
                data-test="notifications-badge"
                aria-hidden="true"
                className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                {badgeDisplay}
              </span>
            ) : null}
            {paused ? (
              <span
                data-test="notifications-paused-glyph"
                aria-hidden="true"
                className="pointer-events-none absolute -right-1 -top-1 flex size-[18px] items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
                {/* 10px, because at the 8px it was this was a dot, and a dot is
                    what an unread badge looks like. */}
                <Pause className="size-2.5 fill-current" />
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
      </PressedTooltip>

      <PressedPopoverContent
        size="paletteForm"
        align="end"
        aria-labelledby={titleId}
        data-test="notifications-popover"
        onOpenAutoFocus={focusFirstRow}
        onInteractOutside={keepOpenForToast}
        // A column that never scrolls itself: the panel inside it caps the list
        // to what is left of the available height, so the header and the toolbar
        // stay put and only the rows move. The cap is the room the page leaves,
        // and no taller than a long list is worth.
        //
        // A short fade and drop on the way in, from the browser's own starting
        // style (`starting:`), which is the first style the popup is drawn with.
        // Radix does not set a starting or ending state of its own, so the
        // classes that waited for one never matched and the popup just appeared.
        // It leaves at once, because Radix removes it the moment it closes.
        // Reduced motion turns the transition off.
        className="flex max-h-[min(var(--radix-popover-content-available-height),80vh,44rem)] flex-col overflow-hidden transition-[opacity,translate] duration-150 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:transition-none">
        <NotificationsPanel
          {...feed}
          variant="popover"
          titleId={titleId}
          alertSettingsPath={ALERT_SETTINGS_PATH}
          onNavigate={() => setOpen(false)}
          onConfirmingChange={(next) => {
            confirming.current = next;
          }}
        />
      </PressedPopoverContent>
    </Popover>
  );
}

export default HeaderNotificationsButton;
