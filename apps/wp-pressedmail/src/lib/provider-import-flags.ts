import { isTruthyRuntimeFlag } from "@/lib/runtime-config";

/**
 * Whether this build carries contacts or calendar import. Constants, so a
 * build without either drops every gated lazy chunk. Tests set the globals
 * with vi.stubGlobal.
 */
export const contactsImportBuildEnabled =
  typeof __ENABLE_CONTACTS_SYNC__ === "boolean"
    ? __ENABLE_CONTACTS_SYNC__
    : (
        globalThis as typeof globalThis & {
          __ENABLE_CONTACTS_SYNC__?: boolean;
        }
      ).__ENABLE_CONTACTS_SYNC__ === true;

export const calendarImportBuildEnabled =
  typeof __ENABLE_CALENDAR_SYNC__ === "boolean"
    ? __ENABLE_CALENDAR_SYNC__
    : (
        globalThis as typeof globalThis & {
          __ENABLE_CALENDAR_SYNC__?: boolean;
        }
      ).__ENABLE_CALENDAR_SYNC__ === true;

export const providerImportBuildEnabled =
  contactsImportBuildEnabled || calendarImportBuildEnabled;

/**
 * The build carries import and the PressedMail Contacts & Calendars plugin
 * turned it on for this page load (Pro sets `providerSync` at runtime).
 */
export function providerImportOn(): boolean {
  return (
    providerImportBuildEnabled &&
    typeof window !== "undefined" &&
    isTruthyRuntimeFlag(window.pressedmailPlugin?.providerSync)
  );
}
