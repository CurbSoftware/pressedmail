/**
 * Occurrence identity for recurring local events.
 *
 * The server expands a recurring series into occurrences that all share the
 * series id. Each one also carries `occurrence_start`: its original start in
 * RFC 5545 UTC form ("20260421T140000Z"), the RECURRENCE-ID. The id alone
 * names the series; the pair names one occurrence.
 */

import type { CalendarContextValue } from "@/types/calendar";

export interface OccurrenceIdentity {
  /** RECURRENCE-ID of an expanded occurrence; absent on single events. */
  occurrence_start?: string | null;
}

/** Which part of a series an edit or delete made from one occurrence changes. */
export type RecurrenceScope = "this" | "following" | "all";

/** The occurrence an edit or delete names, and how far it reaches. */
export interface OccurrenceTarget {
  occurrence_start: string;
  scope: RecurrenceScope;
}

/** Stable key for one event or one occurrence of a series. */
export function eventKey(event: { id: number } & OccurrenceIdentity): string {
  return event.occurrence_start
    ? `${event.id}@${event.occurrence_start}`
    : String(event.id);
}

/** Whether this row is one expanded occurrence of a recurring series. */
export function isOccurrence(event: OccurrenceIdentity): boolean {
  return Boolean(event.occurrence_start);
}

/**
 * The calendar context, with a delete that can name one occurrence.
 *
 * A wider parameter list keeps it assignable wherever the base value is
 * expected.
 */
export interface ScopedCalendarContextValue extends Omit<
  CalendarContextValue,
  "deleteLocalEvent" | "sendCalendarInvite"
> {
  deleteLocalEvent: (
    eventId: number,
    target?: OccurrenceTarget,
  ) => Promise<{ success: boolean; error?: string }>;
  /**
   * Send an invitation, update or cancellation. Pass the same operationKey
   * when retrying one intent so no guest is emailed twice.
   */
  sendCalendarInvite: (
    eventId: number,
    attendees: string[],
    kind?: "invite" | "update" | "cancel",
    operationKey?: string,
  ) => Promise<{ success: boolean; sent?: number; error?: string }>;
}
