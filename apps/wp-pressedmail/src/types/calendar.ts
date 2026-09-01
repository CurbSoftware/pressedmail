/**
 * Calendar Types
 *
 * TypeScript definitions for the Calendar feature.
 * Supports both local calendars (Free tier) and synced calendars (Pro tier).
 *
 * @since 1.1.0
 */

// ============================================
// LOCAL CALENDAR TYPES (Free Tier)
// ============================================

/**
 * Per-calendar display settings (Pro only).
 */
export interface CalendarSettings {
  /** Default view when opening this calendar */
  default_view?: "day" | "week" | "month";
  /** Start hour for day/week views (0-23) */
  day_start_hour?: number;
  /** End hour for day/week views (0-23) */
  day_end_hour?: number;
  /** Time format for display */
  time_format?: "12h" | "24h";
}

/**
 * Local calendar interface (stored locally, not synced).
 */
export interface LocalCalendar {
  /** Unique calendar ID */
  id: number;
  /** WordPress user ID */
  user_id: number;
  /** Calendar name */
  name: string;
  /** Calendar color (hex) */
  color: string;
  /** Whether this is the default calendar */
  is_default: boolean;
  /** Per-calendar display settings (Pro only) */
  settings?: CalendarSettings | null;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

/**
 * Data for creating a local calendar.
 */
export interface CreateLocalCalendarData {
  name: string;
  color?: string;
  is_default?: boolean;
}

/**
 * Data for updating a local calendar.
 */
export interface UpdateLocalCalendarData {
  name?: string;
  color?: string;
  settings?: CalendarSettings;
}

/**
 * Recurrence frequency type.
 */
export type RecurrenceFrequency =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

/**
 * Parsed recurrence rule for UI display.
 */
export interface ParsedRecurrence {
  /** Frequency of recurrence */
  frequency: RecurrenceFrequency;
  /** Interval between occurrences (e.g., every 2 weeks) */
  interval: number;
  /** Days of week for weekly recurrence (0=Sunday, 1=Monday, etc.) */
  byDay?: number[];
  /** Day of month for monthly recurrence */
  byMonthDay?: number;
  /** End condition: by count or by date */
  endType: "never" | "count" | "until";
  /** Number of occurrences (if endType is "count") */
  count?: number;
  /** End date (if endType is "until") */
  until?: string;
}

/**
 * Local calendar event interface.
 */
export interface LocalCalendarEvent {
  /** Unique event ID */
  id: number;
  /** WordPress user ID */
  user_id: number;
  /** Local calendar ID */
  local_calendar_id: number;
  /** Event title */
  title: string;
  /** Event description */
  description: string | null;
  /** Start date/time (ISO 8601) */
  start_datetime: string;
  /** End date/time (ISO 8601) */
  end_datetime: string;
  /** Whether event is all-day */
  all_day: boolean;
  /** Event location */
  location: string | null;
  /** Event timezone */
  timezone: string;
  /** Attendees (email list) */
  attendees: string[];
  /** Reminder minutes before event */
  reminder_minutes: number;
  /** Event visibility */
  visibility: "default" | "public" | "private";
  /** Busy status */
  busy_status: "busy" | "free" | "tentative";
  /** Provider type */
  provider: "internal" | "google" | "outlook";
  /** Whether this is a recurring event */
  is_recurring: boolean;
  /** RRULE string for recurrence (e.g., "FREQ=WEEKLY;BYDAY=MO,WE,FR") */
  recurrence_rule: string | null;
  /** ID of the parent recurring event (for instances) */
  recurrence_id: number | null;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

/**
 * Data for creating a local event.
 */
export interface CreateLocalEventData {
  title: string;
  local_calendar_id?: number;
  description?: string;
  start_datetime: string;
  end_datetime: string;
  all_day?: boolean;
  location?: string;
  timezone?: string;
  attendees?: string[];
  reminder_minutes?: number;
  visibility?: "default" | "public" | "private";
  busy_status?: "busy" | "free" | "tentative";
  /** RRULE string for recurring events (Pro feature) */
  recurrence_rule?: string;
}

/**
 * Data for updating a local event.
 */
export interface UpdateLocalEventData {
  title?: string;
  local_calendar_id?: number;
  description?: string | null;
  start_datetime?: string;
  end_datetime?: string;
  all_day?: boolean;
  location?: string | null;
  timezone?: string;
  attendees?: string[];
  reminder_minutes?: number;
  visibility?: "default" | "public" | "private";
  busy_status?: "busy" | "free" | "tentative";
  /** RRULE string for recurring events (Pro feature) */
  recurrence_rule?: string | null;
}

/**
 * Local calendar capabilities (tier-based limits).
 */
export interface LocalCalendarCapabilities {
  /** Whether calendar feature is available */
  available: boolean;
  /** Whether user can create events */
  create: boolean;
  /** Maximum calendars allowed (-1 for unlimited) */
  max_calendars: number;
  /** Maximum events allowed (-1 for unlimited, 0 for disabled) */
  max_events: number;
  /** Whether events feature is available (false when max_events = 0) */
  events_available: boolean;
  /** Current calendar count */
  calendar_count: number;
  /** Current event count */
  event_count: number;
  /** Whether user can add more calendars */
  can_add_calendar: boolean;
  /** Whether user can add more events */
  can_add_event: boolean;
  /** Whether recurring events are supported */
  can_recur: boolean;
  /** Whether calendar sync is available (Pro) */
  can_sync: boolean;
}

/**
 * Available calendar colors.
 */
export const CALENDAR_COLORS = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#22c55e", // Green
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#84cc16", // Lime
  "#f97316", // Orange
  "#6366f1", // Indigo
] as const;

export type CalendarColor = (typeof CALENDAR_COLORS)[number];

// ============================================
// PRO CALENDAR TYPES
// ============================================

/**
 * Event reminder type.
 */
export type ReminderType =
  | "none"
  | "5min"
  | "15min"
  | "30min"
  | "1hour"
  | "1day";

/**
 * Event recurrence type.
 */
export type RecurrenceType = "none" | "daily" | "weekly" | "monthly" | "yearly";

/**
 * Calendar event interface.
 */
export interface CalendarEvent {
  /** Unique event ID */
  id: number;
  /** WordPress user ID */
  user_id: number;
  /** Email account ID (optional) */
  account_id: number | null;
  /** Event title */
  title: string;
  /** Event description */
  description: string | null;
  /** Start date/time (ISO 8601) */
  start_date: string;
  /** End date/time (ISO 8601) */
  end_date: string;
  /** Whether event is all-day */
  all_day: boolean;
  /** Event location */
  location: string | null;
  /** Reminder setting */
  reminder: ReminderType;
  /** Recurrence setting */
  recurrence: RecurrenceType;
  /** Linked email ID (from extracted event) */
  email_id: number | null;
  /** Event color for UI display */
  color: string | null;
  /** Event tags */
  tags: string[];
  /** Whether event is completed/done */
  is_completed: boolean;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

/**
 * Calendar view type.
 */
export type CalendarView = "day" | "week" | "month" | "agenda" | "list";

/**
 * Calendar capabilities (tier-based limits).
 */
export interface CalendarCapabilities {
  /** Whether calendar feature is available */
  available: boolean;
  /** Whether user can create new events */
  create: boolean;
  /** Whether user can import events */
  import: boolean;
  /** Whether user can export events */
  export: boolean;
  /** Whether email event extraction is enabled */
  email_extraction: boolean;
  /** Whether recurring events are supported */
  recurrence: boolean;
  /** Maximum events allowed (-1 for unlimited) */
  max_events: number;
  /** Current event count */
  current_count: number;
}

/**
 * Data for creating a new event.
 */
export interface CreateEventData {
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  all_day?: boolean;
  location?: string;
  reminder?: ReminderType;
  recurrence?: RecurrenceType;
  email_id?: number;
  color?: string;
  tags?: string[];
  account_id?: number | null;
}

/**
 * Data for updating an existing event.
 */
export interface UpdateEventData {
  title?: string;
  description?: string | null;
  start_date?: string;
  end_date?: string;
  all_day?: boolean;
  location?: string | null;
  reminder?: ReminderType;
  recurrence?: RecurrenceType;
  color?: string | null;
  tags?: string[];
  is_completed?: boolean;
}

/**
 * Date range for fetching events.
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Extracted event from email.
 */
export interface ExtractedEvent {
  title: string;
  start_date: string;
  end_date: string;
  location: string | null;
  description: string | null;
  email_id: number;
}

/**
 * API response types.
 */
export interface CalendarEventsResponse {
  status: "success" | "error";
  events: CalendarEvent[];
  total: number;
  capabilities?: CalendarCapabilities;
  message?: string;
}

export interface CalendarEventResponse {
  status: "success" | "error";
  event?: CalendarEvent;
  message?: string;
}

export interface CalendarOperationResponse {
  status: "success" | "error";
  event?: CalendarEvent;
  message?: string;
}

export interface ExtractedEventsResponse {
  status: "success" | "error";
  events: ExtractedEvent[];
  message?: string;
}

/**
 * Calendar context value interface.
 */
export interface CalendarContextValue {
  /** All events */
  events: CalendarEvent[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Capabilities */
  capabilities: CalendarCapabilities | null;
  /** Current view */
  currentView: CalendarView;
  /** Current date (for navigation) */
  currentDate: Date;
  /** Set current view */
  setCurrentView: (view: CalendarView) => void;
  /** Set current date */
  setCurrentDate: (date: Date) => void;
  /** Fetch events for date range */
  fetchEvents: (start: Date, end: Date) => Promise<void>;
  /** Get a single event */
  getEvent: (eventId: number) => Promise<CalendarEvent | null>;
  /** Create a new event */
  createEvent: (
    data: CreateEventData,
  ) => Promise<{ success: boolean; event?: CalendarEvent; error?: string }>;
  /** Update an event */
  updateEvent: (
    eventId: number,
    data: UpdateEventData,
  ) => Promise<{ success: boolean; event?: CalendarEvent; error?: string }>;
  /** Delete an event */
  deleteEvent: (
    eventId: number,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Toggle event completion */
  toggleComplete: (
    eventId: number,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Extract events from email */
  extractEventsFromEmail: (
    emailId: number,
  ) => Promise<{ success: boolean; events?: ExtractedEvent[]; error?: string }>;
  /** Get events for a specific day */
  getEventsForDay: (date: Date) => CalendarEvent[];
  /** Get upcoming events */
  getUpcomingEvents: (limit?: number) => CalendarEvent[];

  // Local Calendar Features (Free Tier)
  /** Local calendars */
  localCalendars: LocalCalendar[];
  /** Local events */
  localEvents: LocalCalendarEvent[];
  /** Local calendar capabilities */
  localCapabilities: LocalCalendarCapabilities | null;
  /** Local loading state */
  localLoading: boolean;
  /** Fetch local calendars */
  fetchLocalCalendars: () => Promise<{
    success: boolean;
    calendars?: LocalCalendar[];
    error?: string;
  }>;
  /** Create a local calendar */
  createLocalCalendar: (data: CreateLocalCalendarData) => Promise<{
    success: boolean;
    calendar?: LocalCalendar;
    error?: string;
  }>;
  /** Update a local calendar */
  updateLocalCalendar: (
    calendarId: number,
    data: UpdateLocalCalendarData,
  ) => Promise<{
    success: boolean;
    calendar?: LocalCalendar;
    error?: string;
  }>;
  /** Delete a local calendar */
  deleteLocalCalendar: (
    calendarId: number,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Set a calendar as default */
  setDefaultCalendar: (calendarId: number) => Promise<{
    success: boolean;
    calendar?: LocalCalendar;
    error?: string;
  }>;
  /** Fetch local events for date range */
  fetchLocalEvents: (
    start: Date,
    end: Date,
    calendarId?: number,
  ) => Promise<{
    success: boolean;
    events?: LocalCalendarEvent[];
    error?: string;
  }>;
  /** Create a local event */
  createLocalEvent: (data: CreateLocalEventData) => Promise<{
    success: boolean;
    event?: LocalCalendarEvent;
    error?: string;
  }>;
  /** Update a local event */
  updateLocalEvent: (
    eventId: number,
    data: UpdateLocalEventData,
  ) => Promise<{
    success: boolean;
    event?: LocalCalendarEvent;
    error?: string;
  }>;
  /** Delete a local event */
  deleteLocalEvent: (
    eventId: number,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Get local events for a specific day */
  getLocalEventsForDay: (date: Date) => LocalCalendarEvent[];
  /** Get upcoming local events */
  getUpcomingLocalEvents: (limit?: number) => LocalCalendarEvent[];
  /** Re-read the local-event range currently visible in the calendar. */
  refreshVisibleLocalEvents: () => Promise<{
    success: boolean;
    events?: LocalCalendarEvent[];
    error?: string;
  }>;
  /** Get the default calendar */
  getDefaultCalendar: () => LocalCalendar | undefined;
  /** Send iCalendar invitation/update/cancellation to event guests */
  sendCalendarInvite: (
    eventId: number,
    attendees: string[],
    kind?: "invite" | "update" | "cancel",
  ) => Promise<{ success: boolean; sent?: number; error?: string }>;

  // Pro: Calendar Sync
  /** Get connected calendars */
  getConnectedCalendars: () => Promise<{
    success: boolean;
    calendars?: ConnectedCalendar[];
    error?: string;
  }>;
  /** Get OAuth auth URL for provider */
  getAuthUrl: (
    provider: CalendarSyncProvider,
  ) => Promise<{ success: boolean; url?: string; error?: string }>;
  /** Connect calendar provider */
  connectProvider: (
    provider: CalendarSyncProvider,
    authCode: string,
  ) => Promise<{
    success: boolean;
    calendars?: ConnectedCalendar[];
    error?: string;
  }>;
  /** Connect a CalDAV server with URL + credentials (no OAuth). */
  connectCalDAV: (params: {
    url: string;
    username: string;
    password: string;
    displayName?: string;
  }) => Promise<{
    success: boolean;
    calendars?: ConnectedCalendar[];
    error?: string;
  }>;
  /** Disconnect calendar provider */
  disconnectProvider: (
    provider: CalendarSyncProvider,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Sync a specific calendar */
  syncCalendar: (calendarId: number) => Promise<{
    success: boolean;
    result?: CalendarSyncResult;
    error?: string;
  }>;
  /** Toggle calendar sync on/off */
  toggleCalendarSync: (
    calendarId: number,
    enabled: boolean,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Get sync status */
  getSyncStatus: () => Promise<{
    success: boolean;
    status?: CalendarSyncStatus;
    error?: string;
  }>;
  /** Get free/busy information */
  getFreeBusy: (
    start: Date,
    end: Date,
    calendarIds?: number[],
  ) => Promise<{ success: boolean; slots?: FreeBusySlot[]; error?: string }>;
}

// ============================================
// PRO: CALENDAR SYNC TYPES
// ============================================

/**
 * Calendar sync provider type.
 *
 * `caldav` covers any RFC 4791 server (Fastmail, Nextcloud, Radicale, iCloud,
 * etc.) and is connected via username/password against a server URL rather
 * than an OAuth code exchange.
 */
export type CalendarSyncProvider = "google" | "outlook" | "caldav";

/**
 * Connected external calendar.
 */
export interface ConnectedCalendar {
  id: number;
  user_id: number;
  provider: CalendarSyncProvider;
  external_id: string;
  name: string;
  color: string | null;
  is_primary: boolean;
  sync_enabled: boolean;
  access_role: "owner" | "writer" | "reader";
  last_synced_at: string | null;
  created_at: string;
}

/**
 * Calendar sync status.
 */
export interface CalendarSyncStatus {
  google: {
    connected: boolean;
    calendars: number;
    last_synced_at: string | null;
  } | null;
  outlook: {
    connected: boolean;
    calendars: number;
    last_synced_at: string | null;
  } | null;
  caldav?: {
    connected: boolean;
    calendars: number;
    last_synced_at: string | null;
  } | null;
}

/**
 * Calendar sync result.
 */
export interface CalendarSyncResult {
  imported: number;
  exported: number;
  updated: number;
  deleted: number;
  errors: string[];
}

/**
 * Free/busy time slot.
 */
export interface FreeBusySlot {
  start: string;
  end: string;
  status: "free" | "busy" | "tentative";
  calendar_id?: number;
  calendar_name?: string;
}

// ============================================
// LOCAL CALENDAR API RESPONSE TYPES
// ============================================

/**
 * Local calendars API response.
 */
export interface LocalCalendarsResponse {
  status: "success" | "error";
  calendars?: LocalCalendar[];
  capabilities?: LocalCalendarCapabilities;
  message?: string;
}

/**
 * Local calendar operation response.
 */
export interface LocalCalendarOperationResponse {
  status: "success" | "error";
  calendar?: LocalCalendar;
  capabilities?: LocalCalendarCapabilities;
  message?: string;
}

/**
 * Local events API response.
 */
export interface LocalEventsResponse {
  status: "success" | "error";
  events?: LocalCalendarEvent[];
  total?: number;
  capabilities?: LocalCalendarCapabilities;
  message?: string;
}

/**
 * Local event operation response.
 */
export interface LocalEventOperationResponse {
  status: "success" | "error";
  event?: LocalCalendarEvent;
  capabilities?: LocalCalendarCapabilities;
  message?: string;
}

/**
 * Layout slot props for the week calendar. See the note in `types/contacts.ts`:
 * deriving these from the component tied the shared layout types to an
 * implementation the Free build never compiles.
 */
export interface WeekCalendarProps {
  /** Current date (week containing this date will be shown) */
  currentDate: Date;
  /** All events to display */
  events: CalendarEvent[];
  /** Called when a time slot is clicked */
  onTimeSlotClick?: (date: Date, hour: number) => void;
  /** Called when a contextual time range is selected */
  onTimeRangeSelect?: (start: Date, end: Date) => void;
  /** Called when the all-day row should create an event */
  onAllDayCreate?: (date: Date) => void;
  /** Called when an event is clicked */
  onEventClick?: (event: CalendarEvent) => void;
  /** Start hour (default 6 = 6 AM) */
  startHour?: number;
  /** End hour (default 22 = 10 PM) */
  endHour?: number;
  /** Time format: 12-hour or 24-hour */
  timeFormat?: "12h" | "24h";
  /** Custom class name */
  className?: string;
}
