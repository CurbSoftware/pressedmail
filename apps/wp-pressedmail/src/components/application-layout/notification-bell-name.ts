import { __, sprintf } from "@wordpress/i18n";

/**
 * What the bell is called to a screen reader and in its tooltip.
 *
 * A paused bell hides its badge on purpose, so the number it would have shown has
 * to be in the name, or nobody learns that mail piled up without opening it. A
 * muted bell looks different from a normal one, and says so for the same reason:
 * someone who muted it last week and hears nothing has no other hint.
 */
export function notificationBellName({
  unreadCount,
  pausedText,
  muted = false,
}: {
  unreadCount: number;
  /** When the pause ends, such as "Paused until 3:40 PM". Empty when not paused. */
  pausedText: string | null;
  /** Whether sound and pop-ups are muted. */
  muted?: boolean;
}): string {
  const label = __("Notifications", "pressedmail");
  let name = label;
  if (pausedText === null) {
    if (unreadCount > 0) {
      name = sprintf(
        /* translators: 1: "Notifications", 2: how many are unread. */
        __("%1$s, %2$d unread", "pressedmail"),
        label,
        unreadCount,
      );
    }
  } else if (unreadCount > 0) {
    name = sprintf(
      /* translators: 1: "Notifications", 2: how many are unread, 3: when the pause ends, such as "Paused until 3:40 PM". */
      __("%1$s, %2$d unread. %3$s", "pressedmail"),
      label,
      unreadCount,
      pausedText,
    );
  } else {
    name = sprintf(
      /* translators: 1: "Notifications", 2: when the pause ends, such as "Paused until 3:40 PM". */
      __("%1$s. %2$s", "pressedmail"),
      label,
      pausedText,
    );
  }
  return muted
    ? sprintf(
        /* translators: 1: the bell's name so far, such as "Notifications, 3 unread", 2: "Muted". */
        __("%1$s. %2$s", "pressedmail"),
        name,
        __("Muted", "pressedmail"),
      )
    : name;
}
