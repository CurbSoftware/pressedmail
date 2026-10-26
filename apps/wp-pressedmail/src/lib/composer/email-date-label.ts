import { parseCanonicalDateValue } from "@kit/plate/date";

import { formatCalendarDate } from "@/components/calendar/calendar-intl";

/**
 * What a date chip says in a sent email: the absolute date in the author's
 * locale ("October 26, 2026"). "Today" is only true on the day it was sent,
 * so the relative label stays in the editor. A value that is not a calendar
 * date is sent as written.
 */
export function emailDateLabel(node: { date?: unknown; rawDate?: unknown }): string {
  if (typeof node.rawDate === "string" && node.rawDate) return node.rawDate;
  if (typeof node.date !== "string" || !node.date) return "";
  const parsed = parseCanonicalDateValue(node.date);
  return parsed ? formatCalendarDate(parsed, { dateStyle: "long" }) : node.date;
}
