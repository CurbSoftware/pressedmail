"use client";

import { __ } from "@wordpress/i18n";
import { BellOff } from "lucide-react";
import { Button, toast } from "@kit/ui/plugin";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { cn } from "@/lib/utils";

/**
 * The mute toggle in the notification popup's toolbar.
 *
 * Muting silences sound and desktop pop-ups until it is switched off, and
 * touches nothing else: the list, the badge and the email copy carry on. Both
 * alerts exist in every edition (Settings > Preferences > Notifications offers
 * them in Free too), so every edition has the control.
 *
 * The button is named for what pressing it does, "Mute" and then "Unmute", and
 * carries no pressed state beside that: a name that flipped while a pressed state
 * said the opposite is how the tooltip and a screen reader came to disagree.
 */
export function NotificationMuteButton({
  activeClassName,
  className,
}: {
  /** How the toolbar dresses a switched-on button. */
  activeClassName: string;
  /** Anything else the toolbar wants on the button, such as a bigger touch target. */
  className?: string;
}) {
  const { preferences, updatePreferences } = useUserPreferences();
  const muted = preferences.notification_muted === true;
  const label = muted
    ? __("Unmute sound and pop-ups", "pressedmail")
    : __("Mute sound and pop-ups", "pressedmail");

  const toggle = async () => {
    if (!(await updatePreferences({ notification_muted: !muted }))) {
      toast.error(
        muted
          ? __("Could not unmute notifications", "pressedmail")
          : __("Could not mute notifications", "pressedmail"),
      );
    }
  };

  return (
    <PressedTooltip content={label} side="bottom">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        data-roving-item=""
        data-test="notifications-mute"
        aria-label={label}
        className={cn(
          "text-muted-foreground hover:text-foreground",
          className,
          muted && activeClassName,
        )}
        onClick={() => void toggle()}>
        <BellOff className="size-4" aria-hidden="true" />
      </Button>
    </PressedTooltip>
  );
}

/**
 * One fact in the popup's status line, as a piece that wraps whole: a pill the
 * height of the line, so a line with one is no taller than a line with none, and
 * a narrow sheet breaks between facts and never inside one.
 */
export const NOTIFICATION_STATUS_CHIP =
  "inline-flex h-4 items-center gap-1 whitespace-nowrap rounded-full bg-muted px-1.5 text-[11px] font-medium leading-none text-foreground";

/** "Muted", beside the unread count in the popup's status line. */
export function NotificationMutedNote() {
  const { preferences } = useUserPreferences();
  if (preferences.notification_muted !== true) return null;

  return (
    <span
      data-test="notifications-muted-note"
      className={NOTIFICATION_STATUS_CHIP}>
      <BellOff className="size-3 shrink-0" aria-hidden="true" />
      {__("Muted", "pressedmail")}
    </span>
  );
}
