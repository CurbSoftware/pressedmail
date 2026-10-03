import { __ } from "@wordpress/i18n";

import { getCalendarLocale } from "@/components/calendar/calendar-intl";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type AgeUnit = "minute" | "hour" | "day";

/** The largest whole unit of a gap up to a week, or null for anything older. */
function ageIn(gap: number): { unit: AgeUnit; count: number } | null {
  if (gap < HOUR) return { unit: "minute", count: Math.floor(gap / MINUTE) };
  if (gap < DAY) return { unit: "hour", count: Math.floor(gap / HOUR) };
  if (gap < 7 * DAY) return { unit: "day", count: Math.floor(gap / DAY) };
  return null;
}

function parse(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * How long ago, in the fewest characters: "Now", "5m", "3h", "2d", and from a
 * week on the date itself ("Sep 12"). It sits on the title line of a row, where
 * a sentence would push the title out. The units come from the reader's own
 * language, so a French screen does not get an English clock. The long form is
 * `fullAge`, for a screen reader and the tooltip.
 */
export function compactAge(value: string, now: number = Date.now()): string {
  const date = parse(value);
  if (!date) return "";
  const gap = now - date.getTime();
  if (gap < MINUTE) return __("Now", "pressedmail");
  const age = ageIn(gap);
  const locale = getCalendarLocale();
  if (!age) {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    }).format(date);
  }
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: age.unit,
    unitDisplay: "narrow",
  }).format(age.count);
}

/** "5 minutes ago", "yesterday", or the full date from a week on, in the reader's language. */
export function fullAge(value: string, now: number = Date.now()): string {
  const date = parse(value);
  if (!date) return "";
  const gap = now - date.getTime();
  const locale = getCalendarLocale();
  if (gap < MINUTE) return __("Just now", "pressedmail");
  const age = ageIn(gap);
  if (!age) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    -age.count,
    age.unit,
  );
}

export type NotificationDay = "today" | "yesterday" | "week" | "older";

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Which day group a row belongs under, by the reader's own calendar days. */
export function notificationDay(
  value: string,
  now: number = Date.now(),
): NotificationDay {
  const date = parse(value);
  if (!date) return "older";
  // Rounded, not floored: a day that is 23 or 25 hours long around a clock
  // change is still one day.
  const days = Math.round(
    (startOfDay(new Date(now)) - startOfDay(date)) / DAY,
  );
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return "week";
  return "older";
}

export function notificationDayLabel(day: NotificationDay): string {
  switch (day) {
    case "today":
      return __("Today", "pressedmail");
    case "yesterday":
      return __("Yesterday", "pressedmail");
    case "week":
      return __("Last 7 days", "pressedmail");
    default:
      return __("Older", "pressedmail");
  }
}

/**
 * The time on a row, the way the group it sits under reads it. Under Today it is
 * how long ago ("Now", "5m", "3h"). Under Yesterday it is the clock time, since
 * the hours since then say less than the time of day. Under Last 7 days it is the
 * weekday, and from a week on the date. An age counted in hours cannot do this:
 * it put the same "1d" under Yesterday and under Last 7 days, because it counts
 * 24 hour spans and the groups count calendar days.
 */
export function rowTime(value: string, now: number = Date.now()): string {
  const date = parse(value);
  if (!date) return "";
  const day = notificationDay(value, now);
  if (day === "today") return compactAge(value, now);
  const locale = getCalendarLocale();
  if (day === "yesterday") {
    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }
  if (day === "week") {
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  }
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    // Retention is 30 days, so a year only shows around New Year.
    ...(date.getFullYear() === new Date(now).getFullYear()
      ? {}
      : { year: "numeric" as const }),
  }).format(date);
}

/** `Intl.Segmenter`, which the plugin's TypeScript library does not know yet. */
type GraphemeSegmenter = new (
  locale?: string,
  options?: { granularity: "grapheme" },
) => { segment(text: string): Iterable<{ segment: string }> };

/** The first user-perceived character, so a letter with its marks is never cut in two. */
function firstGrapheme(text: string): string {
  const Segmenter = (Intl as unknown as { Segmenter?: GraphemeSegmenter })
    .Segmenter;
  if (Segmenter) {
    for (const { segment } of new Segmenter(undefined, {
      granularity: "grapheme",
    }).segment(text)) {
      return segment;
    }
    return "";
  }
  return Array.from(text)[0] ?? "";
}

/**
 * One or two letters for a sender's avatar. "Hannah Brooks" is "HB", and an
 * address with no name is read the way it is written: "hannah.brooks@acme.test"
 * is "HB" too. Characters are taken whole, so an emoji or a letter outside the
 * basic plane is not cut in half.
 *
 * Only a script with capitals has initials that read as initials. In Arabic,
 * Hebrew or Thai the first letters of two words are two bare letters side by
 * side (two alefs look like a pause icon), so those names get one letter, the
 * way mail clients do.
 */
export function initialsOf(sender: string): string {
  const name = sender.includes("@") ? sender.split("@")[0] ?? "" : sender;
  const letters = name
    .split(/[\s._+-]+/u)
    .map((word) => firstGrapheme(word.replace(/^[^\p{L}\p{N}]+/u, "")))
    .filter(Boolean);
  const first = letters[0] ?? "";
  const uncased =
    /^\p{L}/u.test(first) &&
    first.toLocaleUpperCase() === first.toLocaleLowerCase();
  return (uncased ? letters.slice(0, 1) : letters.slice(0, 2))
    .join("")
    .toLocaleUpperCase();
}
