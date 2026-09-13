import { __, sprintf } from "@wordpress/i18n";
import type { LocalCalendarEvent } from "@/types/calendar";
import { calendarFormatter, getCalendarLocale } from "./calendar-intl";

export interface TimezoneOption {
  value: string;
  label: string;
}

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/Vancouver",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Australia/Sydney",
];

const DATE_TIME_PARTS_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  hourCycle: "h23",
};

function parseLocalInput(value: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!match) {
    throw new Error(`Invalid local date input: ${value}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? 0),
    minute: Number(match[5] ?? 0),
    second: Number(match[6] ?? 0),
  };
}

export function parseUtcDate(value: string): Date {
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) {
    return new Date(value);
  }

  const normalized = value.includes("T")
    ? `${value}Z`
    : `${value.replace(" ", "T")}Z`;
  return new Date(normalized);
}

function getTimeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    ...DATE_TIME_PARTS_FORMAT,
    timeZone,
  });
  const parts = formatter.formatToParts(date);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: valueFor("year"),
    month: valueFor("month"),
    day: valueFor("day"),
    hour: valueFor("hour"),
    minute: valueFor("minute"),
    second: valueFor("second"),
  };
}

function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getTimeZoneParts(date, timeZone);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return zonedAsUtc - date.getTime();
}

function formatOffset(date: Date, timeZone: string): string {
  const offsetMinutes = Math.round(getTimezoneOffsetMs(date, timeZone) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `GMT${sign}${hours}:${minutes}`;
}

export function isValidTimeZone(timeZone: string | null | undefined): boolean {
  if (!timeZone) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function getDefaultTimezone(): string {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(timeZone) ? timeZone : "UTC";
  } catch {
    return "UTC";
  }
}

export function normalizeTimeZone(
  timeZone: string | null | undefined,
  fallback = getDefaultTimezone(),
): string {
  if (isValidTimeZone(timeZone)) {
    return timeZone ?? "UTC";
  }
  return isValidTimeZone(fallback) ? fallback : "UTC";
}

export function getSupportedTimeZones(): string[] {
  const supportedValuesOf = (
    Intl as typeof Intl & {
      supportedValuesOf?: (key: "timeZone") => string[];
    }
  ).supportedValuesOf;
  const values =
    typeof supportedValuesOf === "function"
      ? supportedValuesOf("timeZone")
      : FALLBACK_TIMEZONES;

  return Array.from(new Set([...values, "UTC"]))
    .filter(isValidTimeZone)
    .sort();
}

export function formatTimeZoneLabel(
  timeZone: string,
  date = new Date(),
): string {
  const normalized = normalizeTimeZone(timeZone, "UTC");
  let longName = normalized;

  try {
    const namePart = new Intl.DateTimeFormat(getCalendarLocale(), {
      timeZone: normalized,
      timeZoneName: "long",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value;
    if (namePart) {
      longName = namePart;
    }
  } catch {
    longName = normalized;
  }

  return `${normalized} (${longName}, ${formatOffset(date, normalized)})`;
}

export function getTimezoneOptions(
  userTimeZone = getDefaultTimezone(),
): TimezoneOption[] {
  const normalizedUserTimeZone = normalizeTimeZone(userTimeZone, "UTC");
  const zones = getSupportedTimeZones().filter(
    (timeZone) => timeZone !== normalizedUserTimeZone,
  );

  return [
    {
      value: normalizedUserTimeZone,
      label: sprintf(
        /* translators: %s: timezone name, long name and UTC offset. */
        __("Your timezone: %s", "pressedmail"),
        formatTimeZoneLabel(normalizedUserTimeZone),
      ),
    },
    ...zones.map((timeZone) => ({
      value: timeZone,
      label: formatTimeZoneLabel(timeZone),
    })),
  ];
}

export function zonedInputToUtcIso(value: string, timeZone: string): string {
  const normalizedTimeZone = normalizeTimeZone(timeZone, "UTC");
  const parts = parseLocalInput(value);
  const wallTimeAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  let utcMs = wallTimeAsUtc;
  for (let i = 0; i < 3; i += 1) {
    utcMs =
      wallTimeAsUtc - getTimezoneOffsetMs(new Date(utcMs), normalizedTimeZone);
  }

  return new Date(utcMs).toISOString();
}

export function utcIsoToZonedInput(value: string, timeZone: string): string {
  const date = parseUtcDate(value);
  const normalizedTimeZone = normalizeTimeZone(timeZone, "UTC");
  const parts = getTimeZoneParts(date, normalizedTimeZone);
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** All-day calendar values are wall dates, never browser-timezone instants. */
export function parseCalendarDate(value: string, allDay = false): Date {
  return allDay
    ? new Date(
        value.length === 10
          ? `${value}T00:00:00`
          : value.replace(/(?:Z|[+-]\d{2}:?\d{2})$/i, ""),
      )
    : new Date(value);
}

export function getLocalEventTimezone(event: LocalCalendarEvent): string {
  // ICS DATE values are stored as UTC midnight regardless of the site's zone.
  // Keep older imports correct too; ordinary all-day events were stored using
  // the event timezone and may have an inclusive 23:59 end.
  if (event.all_day && event.external_id) return "UTC";
  return normalizeTimeZone(
    event.timezone,
    event.all_day ? "UTC" : getDefaultTimezone(),
  );
}

export function getLocalEventDate(
  event: LocalCalendarEvent,
  field: "start_datetime" | "end_datetime" = "start_datetime",
): Date {
  return event.all_day
    ? parseCalendarDate(
        utcIsoToZonedInput(event[field], getLocalEventTimezone(event)),
        true,
      )
    : new Date(event[field]);
}

/** Inclusive display end; RFC 5545 midnight DTEND remains exclusive in storage. */
export function getAllDayDisplayEnd(start: Date, end: Date): Date {
  if (
    end > start &&
    end.getHours() === 0 &&
    end.getMinutes() === 0 &&
    end.getSeconds() === 0
  ) {
    return new Date(end.getTime() - 1);
  }
  return end;
}

export function formatEventDateRange(event: LocalCalendarEvent): string {
  const timeZone = getLocalEventTimezone(event);
  const start = event.all_day
    ? getLocalEventDate(event)
    : parseUtcDate(event.start_datetime);
  const end = parseUtcDate(event.end_datetime);
  const dateText = calendarFormatter({
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    ...(event.all_day ? {} : { timeZone }),
  }).format(start);

  if (event.all_day) {
    return sprintf(
      /* translators: 1: event date, 2: timezone name. */
      __("%1$s (all day, %2$s)", "pressedmail"),
      dateText,
      timeZone,
    );
  }

  const timeFormatter = calendarFormatter({
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });

  return sprintf(
    /* translators: 1: event date, 2: time range, 3: timezone name. */
    __("%1$s, %2$s (%3$s)", "pressedmail"),
    dateText,
    timeFormatter.formatRange(start, end),
    timeZone,
  );
}

export function getEventDateText(event: LocalCalendarEvent): string {
  const timeZone = getLocalEventTimezone(event);
  return calendarFormatter({
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    ...(event.all_day ? {} : { timeZone }),
  }).format(
    event.all_day
      ? getLocalEventDate(event)
      : parseUtcDate(event.start_datetime),
  );
}

export function getEventTimeText(event: LocalCalendarEvent): string {
  const timeZone = getLocalEventTimezone(event);
  if (event.all_day) {
    return sprintf(
      /* translators: %s: timezone name. */
      __("All day (%s)", "pressedmail"),
      timeZone,
    );
  }

  const formatter = calendarFormatter({
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });

  return sprintf(
    /* translators: 1: time range, 2: timezone name. */
    __("%1$s (%2$s)", "pressedmail"),
    formatter.formatRange(
      parseUtcDate(event.start_datetime),
      parseUtcDate(event.end_datetime),
    ),
    timeZone,
  );
}
