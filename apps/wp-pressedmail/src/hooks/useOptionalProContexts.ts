/**
 * The Pro contexts shared inbox code reads: AI summaries, auto-tagging,
 * phishing checks, snooze, contacts and the calendar.
 *
 * Each hook here is the real one in Pro and `() => null` in the Free build, so
 * the Free stub behind it compiles out. A caller reads a field only behind the
 * same define (`__ENABLE_AI_SUMMARIZE__ && summaries ? summaries.x : fallback`),
 * so no Pro member name reaches the Free bundle either.
 */
import { useSnooze } from "@/components/snooze/use-snooze";
import { useCalendar } from "@/context/calendar/CalendarContext";
import { useContacts } from "@/context/contacts/ContactsContext";
import { useAutoTagger } from "@/context/auto-tagger";
import { useEmailSummaries } from "@/context/email-summary";
import { usePhishing } from "@/context/phishing/PhishingContext";

export type OptionalEmailSummaries = ReturnType<typeof useEmailSummaries> | null;
export type OptionalAutoTagger = ReturnType<typeof useAutoTagger> | null;
export type OptionalPhishing = ReturnType<typeof usePhishing> | null;
export type OptionalSnooze = ReturnType<typeof useSnooze> | null;
export type OptionalContactList = ReturnType<typeof useContacts> | null;
export type OptionalCalendar = ReturnType<typeof useCalendar> | null;

const none = (): null => null;

export const useOptionalEmailSummaries: () => OptionalEmailSummaries =
  __ENABLE_AI_SUMMARIZE__ ? useEmailSummaries : none;

export const useOptionalAutoTagger: () => OptionalAutoTagger =
  __ENABLE_AI_AUTO_TAGGER__ ? useAutoTagger : none;

export const useOptionalPhishing: () => OptionalPhishing =
  __ENABLE_PHISHING_DETECTION__ ? usePhishing : none;

export const useOptionalSnooze: () => OptionalSnooze = __ENABLE_SNOOZE__
  ? useSnooze
  : none;

export const useOptionalContactList: () => OptionalContactList =
  __ENABLE_CONTACTS__ ? useContacts : none;

export const useOptionalCalendar: () => OptionalCalendar = __ENABLE_CALENDAR__
  ? useCalendar
  : none;
