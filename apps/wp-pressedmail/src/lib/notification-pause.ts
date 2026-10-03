import { __, sprintf } from "@wordpress/i18n";

import { getCalendarLocale } from "@/components/calendar/calendar-intl";
import type { UserPreferences } from "@/hooks/useUserPreferences";

/**
 * `notification_paused_until` for a pause that lasts until the user resumes.
 * Mirrors `UserPreferences::PAUSED_INDEFINITELY`.
 */
export const PAUSED_INDEFINITELY = -1;

/** Where a pause can end, in the order the menu offers them. */
export type PausePreset =
  | "15-minutes"
  | "1-hour"
  | "8-hours"
  | "tomorrow-morning"
  | "until-resumed";

/**
 * The morning a pause can end at is 8:00 on the reader's own clock and in the
 * time zone their browser is in, which is where they will be when it lifts.
 */
const MORNING_HOUR = 8;

type PauseState = Pick<UserPreferences, "notification_paused_until">;

/**
 * How far the browser's clock is from the server's, in milliseconds. A pause ends
 * at a time the server holds it to against its own clock, so a browser that runs
 * hours slow or fast would otherwise show one end time while the server enforced
 * another, on the one channel (the email copy) the reader cannot see.
 */
let serverClockOffsetMs = 0;

/** Learn the offset from the server's clock, sent with every preferences answer. */
export function syncServerClock(serverSeconds: unknown): void {
  const seconds = Number(serverSeconds);
  if (Number.isFinite(seconds) && seconds > 0) {
    serverClockOffsetMs = seconds * 1000 - Date.now();
  }
}

/** The time on the server's clock, in milliseconds since the epoch. */
export function serverNow(): number {
  return Date.now() + serverClockOffsetMs;
}

/**
 * When the pause ends, in milliseconds since the epoch: `Infinity` for a pause
 * until resumed, `null` when notifications are not paused.
 *
 * The stored time is compared with the clock here, on every read. Nothing
 * clears it when it passes, so a pause that has ended just stops reading as one.
 */
export function pausedUntilMs(
  preferences: PauseState,
  now: number = serverNow(),
): number | null {
  const until = Number(preferences.notification_paused_until);
  if (until === PAUSED_INDEFINITELY) return Infinity;
  const ends = until * 1000;
  return Number.isFinite(ends) && ends > now ? ends : null;
}

export function isNotificationsPaused(
  preferences: PauseState,
  now: number = serverNow(),
): boolean {
  return pausedUntilMs(preferences, now) !== null;
}

/**
 * The value to store for a preset: whole seconds, which is all the server
 * accepts, rounded up so a pause is never shorter than it was asked to be. `now`
 * is the server's time (`serverNow()`), read in the reader's time zone for the
 * morning, so a browser clock that is wrong still sets the end time the server
 * will hold it to.
 */
export function pauseUntilFor(preset: PausePreset, now: Date): number {
  const minutes = { "15-minutes": 15, "1-hour": 60, "8-hours": 480 } as const;
  switch (preset) {
    case "until-resumed":
      return PAUSED_INDEFINITELY;
    case "tomorrow-morning": {
      // The coming 8:00. Asked for at half past midnight, that is this morning,
      // not the day after, which would pause for a day and a half.
      const morning = new Date(now);
      morning.setHours(MORNING_HOUR, 0, 0, 0);
      if (morning.getTime() <= now.getTime()) {
        morning.setDate(morning.getDate() + 1);
      }
      return Math.ceil(morning.getTime() / 1000);
    }
    default:
      return Math.ceil((now.getTime() + minutes[preset] * 60_000) / 1000);
  }
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * "Paused until 3:40 PM", "Paused until tomorrow at 8:00 AM", "Paused until Fri
 * 8:00 AM" or "Paused until you resume". Times are written in the language the
 * rest of the plugin is in, so a French screen does not get an English clock.
 */
export function describePause(endsAt: number, now: number = serverNow()): string {
  if (endsAt === Infinity) {
    return __("Paused until you resume", "pressedmail");
  }
  const end = new Date(endsAt);
  const locale = getCalendarLocale();
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(end);
  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(today.getDate() + 1);

  if (sameDay(end, today)) {
    /* translators: %s: a time of day, such as 3:40 PM. */
    return sprintf(__("Paused until %s", "pressedmail"), time);
  }
  if (sameDay(end, tomorrow)) {
    /* translators: %s: a time of day, such as 8:00 AM. */
    return sprintf(__("Paused until tomorrow at %s", "pressedmail"), time);
  }
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(end);
  /* translators: %s: a weekday and a time, such as Fri 8:00 AM. */
  return sprintf(__("Paused until %s", "pressedmail"), weekday);
}
