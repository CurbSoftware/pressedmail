import { createContext, type ReactNode } from "react";

/**
 * The Free build's stand-in for the calendar module.
 *
 * Free has no calendar. Every hook answers "none" and carries no member
 * names, so nothing about the feature reaches the Free bundle. Shared code
 * reads the calendar only through `useOptionalCalendar()` behind
 * `__ENABLE_CALENDAR__`, which compiles out here.
 */
const CalendarContext = /* @__PURE__ */ createContext<null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useCalendar(): null {
  return null;
}

export function useCalendarCapabilities(): null {
  return null;
}

export function useCalendarAvailable(): boolean {
  return false;
}

export function useCanCreateEvent(): boolean {
  return false;
}

export function useUpcomingEvents(_limit: number = 5): never[] {
  return [];
}

export function useTodayEvents(): never[] {
  return [];
}

export function useUpcomingLocalEvents(_limit: number = 5): never[] {
  return [];
}

export default CalendarContext;
