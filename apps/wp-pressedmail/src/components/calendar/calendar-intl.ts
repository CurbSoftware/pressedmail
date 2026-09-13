/**
 * Locale-aware dates and times for the calendar.
 *
 * Every calendar date and time goes through Intl in the plugin's UI locale,
 * the WordPress locale its strings are translated into, and weeks start on
 * the site's start_of_week. Hard-coded "en-US", English weekday names and
 * literal AM/PM gave a German site "Wednesday, September 11" and a Sunday
 * week next to translated labels.
 */

function pluginGlobal(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  return (
    (window.pressedmailPlugin as Record<string, unknown> | undefined) ?? {}
  );
}

function canonical(tag: string): string | undefined {
  try {
    return Intl.getCanonicalLocales(tag)[0];
  } catch {
    return undefined;
  }
}

/**
 * BCP 47 tag for the active WordPress locale ("de_DE" becomes "de-DE").
 *
 * Falls back to the admin page language, then to the browser default.
 */
export function getCalendarLocale(): string | undefined {
  const candidates = [
    pluginGlobal().locale,
    typeof document !== "undefined" ? document.documentElement.lang : "",
  ];
  for (const raw of candidates) {
    if (typeof raw !== "string" || raw === "") continue;
    const tag = raw.replace(/_/g, "-");
    // Some WordPress variants ("pt_PT_ao90") are not valid BCP 47 variants.
    const resolved =
      canonical(tag) ?? canonical(tag.split("-").slice(0, 2).join("-"));
    if (resolved) return resolved;
  }
  return undefined;
}

/** First day of the week, 0 (Sunday) to 6, from the site's start_of_week. */
export function getWeekStartsOn(): number {
  const value = Number(pluginGlobal().startOfWeek);
  return Number.isInteger(value) && value >= 0 && value <= 6 ? value : 0;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** A cached formatter for the calendar locale. */
export function calendarFormatter(
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const locale = getCalendarLocale();
  const key = `${locale ?? ""}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter;
}

/** Format a date in the calendar locale. */
export function formatCalendarDate(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return calendarFormatter(options).format(date);
}

/** Hour and minute, honouring an explicit 12h or 24h display setting. */
export function formatCalendarTime(
  date: Date,
  timeFormat?: "12h" | "24h",
  timeZone?: string,
): string {
  return formatCalendarDate(date, {
    hour: "numeric",
    minute: "2-digit",
    ...(timeFormat ? { hourCycle: timeFormat === "24h" ? "h23" : "h12" } : {}),
    ...(timeZone ? { timeZone } : {}),
  });
}

/** A start and end time as one locale range ("9:00 - 10:30 AM", "09:00-10:30"). */
export function formatCalendarTimeRange(
  start: Date,
  end: Date,
  timeFormat?: "12h" | "24h",
): string {
  return calendarFormatter({
    hour: "numeric",
    minute: "2-digit",
    ...(timeFormat ? { hourCycle: timeFormat === "24h" ? "h23" : "h12" } : {}),
  }).formatRange(start, end);
}

/** An hour-of-day label ("9 AM", "09:00", "9 Uhr") for grid gutters. */
export function formatCalendarHour(
  hour: number,
  timeFormat?: "12h" | "24h",
): string {
  const date = new Date(2026, 0, 1, hour, 0, 0, 0);
  return formatCalendarDate(date, {
    hour: timeFormat === "24h" ? "2-digit" : "numeric",
    ...(timeFormat === "24h" ? { minute: "2-digit" } : {}),
    ...(timeFormat ? { hourCycle: timeFormat === "24h" ? "h23" : "h12" } : {}),
  });
}

/**
 * Weekday names in display order, starting on the site's first day.
 *
 * Each entry keeps its JavaScript day number (0 is Sunday).
 */
export function orderedWeekdays(
  width: "narrow" | "short" | "long" = "short",
): Array<{ day: number; label: string; name: string }> {
  const start = getWeekStartsOn();
  return Array.from({ length: 7 }, (_, index) => {
    const day = (start + index) % 7;
    // 4 January 2026 is a Sunday.
    const date = new Date(2026, 0, 4 + day);
    return {
      day,
      label: formatCalendarDate(date, { weekday: width }),
      name: formatCalendarDate(date, { weekday: "long" }),
    };
  });
}

/** Midnight of the first day of the week that contains a date. */
export function startOfCalendarWeek(date: Date): Date {
  const start = new Date(date);
  const offset = (start.getDay() - getWeekStartsOn() + 7) % 7;
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}
