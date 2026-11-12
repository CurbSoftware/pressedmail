/**
 * iTip types: mirror of what `iTipParser.php` returns. Surfaced on a
 * message envelope when the backend extracts a `text/calendar` attachment
 * carrying a METHOD:REQUEST / REPLY / CANCEL.
 */

export type ITipMethod = "REQUEST" | "REPLY" | "CANCEL" | "PUBLISH";

export type ITipPartStat =
  | "NEEDS-ACTION"
  | "ACCEPTED"
  | "DECLINED"
  | "TENTATIVE"
  | "DELEGATED"
  | "COMPLETED"
  | "IN-PROCESS"
  | "";

export interface ITipAttendee {
  email: string;
  name: string;
  partstat: ITipPartStat;
  role: string;
  rsvp: boolean;
}

export interface ITipOrganizer {
  email: string;
  name: string;
}

export interface ITipEvent {
  method: ITipMethod;
  uid: string;
  summary: string;
  location: string;
  organizer: ITipOrganizer;
  start: string;
  end: string;
  sequence: number;
  attendees: ITipAttendee[];
  /**
   * A date-only event, with no time of day. Absent on an envelope stored
   * before the server sent it.
   */
  all_day?: boolean;
  /**
   * The event repeats and `start` / `end` are its first occurrence. The
   * calendar import route answers 422 for these. Absent on an envelope stored
   * before the server sent it.
   */
  recurring?: boolean;
  /** Exact MIME part containing the parsed calendar payload. */
  attachmentPart?: string;
}
