import { createContext, type ReactNode } from "react";
import type {
  CalendarCapabilities,
  CalendarEvent,
  CalendarView,
  LocalCalendarEvent,
  ScopedCalendarContextValue,
} from "@/types/calendar";

const DISABLED_MESSAGE = "Calendar is not included in this build.";

const EMPTY_CAPABILITIES: CalendarCapabilities = {
  available: false,
  create: false,
  import: false,
  export: false,
  email_extraction: false,
  recurrence: false,
  max_events: 0,
  current_count: 0,
};

const EMPTY_CONTEXT: ScopedCalendarContextValue = {
  events: [],
  loading: false,
  error: null,
  capabilities: EMPTY_CAPABILITIES,
  currentView: "month",
  currentDate: new Date(),
  setCurrentView: (_view: CalendarView) => {},
  setCurrentDate: (_date: Date) => {},
  fetchEvents: async () => {},
  getEvent: async () => null,
  getEventsForDay: () => [],
  getUpcomingEvents: () => [],
  localCalendars: [],
  localEvents: [],
  localCapabilities: null,
  localLoading: false,
  fetchLocalCalendars: async () => ({
    success: false,
    error: DISABLED_MESSAGE,
  }),
  createLocalCalendar: async () => ({
    success: false,
    error: DISABLED_MESSAGE,
  }),
  updateLocalCalendar: async () => ({
    success: false,
    error: DISABLED_MESSAGE,
  }),
  deleteLocalCalendar: async () => ({
    success: false,
    error: DISABLED_MESSAGE,
  }),
  setDefaultCalendar: async () => ({ success: false, error: DISABLED_MESSAGE }),
  fetchLocalEvents: async () => ({ success: false, error: DISABLED_MESSAGE }),
  createLocalEvent: async () => ({ success: false, error: DISABLED_MESSAGE }),
  updateLocalEvent: async () => ({ success: false, error: DISABLED_MESSAGE }),
  deleteLocalEvent: async () => ({ success: false, error: DISABLED_MESSAGE }),
  getLocalEventsForDay: () => [],
  getUpcomingLocalEvents: () => [],
  refreshVisibleLocalEvents: async () => ({ success: false }),
  getDefaultCalendar: () => undefined,
  sendCalendarInvite: async () => ({ success: false, error: DISABLED_MESSAGE }),
  getConnectedCalendars: async () => ({
    success: false,
    error: DISABLED_MESSAGE,
  }),
  getAuthUrl: async () => ({ success: false, error: DISABLED_MESSAGE }),
  connectProvider: async () => ({ success: false, error: DISABLED_MESSAGE }),
  connectCalDAV: async () => ({ success: false, error: DISABLED_MESSAGE }),
  disconnectProvider: async () => ({ success: false, error: DISABLED_MESSAGE }),
  syncCalendar: async () => ({ success: false, error: DISABLED_MESSAGE }),
  toggleCalendarSync: async () => ({ success: false, error: DISABLED_MESSAGE }),
  getSyncStatus: async () => ({ success: false, error: DISABLED_MESSAGE }),
  getFreeBusy: async () => ({ success: false, error: DISABLED_MESSAGE }),
};

const CalendarContext =
  createContext<ScopedCalendarContextValue>(EMPTY_CONTEXT);

export function CalendarProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useCalendar(): ScopedCalendarContextValue {
  return EMPTY_CONTEXT;
}

export function useCalendarCapabilities(): CalendarCapabilities {
  return EMPTY_CAPABILITIES;
}

export function useCalendarAvailable(): boolean {
  return false;
}

export function useCanCreateEvent(): boolean {
  return false;
}

export function useUpcomingEvents(_limit: number = 5): CalendarEvent[] {
  return [];
}

export function useTodayEvents(): CalendarEvent[] {
  return [];
}

export function useUpcomingLocalEvents(
  _limit: number = 5,
): LocalCalendarEvent[] {
  return [];
}

export default CalendarContext;
