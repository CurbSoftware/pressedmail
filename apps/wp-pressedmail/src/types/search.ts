/**
 * Search Types
 *
 * TypeScript types for the unified search functionality.
 *
 * @since 1.3.0
 * @updated 1.4.0 - Added polymorphic search types
 */

import type { EmailMessage } from "./index";
import type { Contact } from "./contacts";
import type { CalendarEvent } from "./calendar";

/**
 * Search scope for polymorphic search.
 */
export type SearchScope = "all" | "emails" | "contacts" | "calendar";

/**
 * UI-facing scope (no "all") for the header search mode selector.
 */
export type HeaderSearchScope = Exclude<SearchScope, "all">;

/**
 * Contact search filters.
 */
export interface ContactSearchFilters {
  /** Filter by name */
  name?: string;
  /** Filter by email */
  email?: string;
  /** Filter by company */
  company?: string;
  /** Filter by contact list ID */
  listId?: number;
  /** Filter contacts with phone numbers */
  hasPhone?: boolean;
  /** Filter by creation date (after) */
  createdAfter?: Date;
  /** Filter by creation date (before) */
  createdBefore?: Date;
}

/**
 * Calendar event search filters.
 */
export interface CalendarSearchFilters {
  /** Filter by event date range */
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  /** Only all-day events */
  allDay?: boolean;
}

/**
 * Default calendar filters.
 */
export const DEFAULT_CALENDAR_FILTERS: CalendarSearchFilters = {
  dateRange: undefined,
  allDay: undefined,
};

/**
 * Unified search filters combining email and contact filters.
 */
export interface UnifiedSearchFilters {
  /** Search scope */
  scope: SearchScope;
  /** Email-specific filters */
  emailFilters?: AdvancedSearchFilters;
  /** Contact-specific filters */
  contactFilters?: ContactSearchFilters;
}

/**
 * Default contact filters.
 */
export const DEFAULT_CONTACT_FILTERS: ContactSearchFilters = {
  name: undefined,
  email: undefined,
  company: undefined,
  listId: undefined,
  hasPhone: undefined,
  createdAfter: undefined,
  createdBefore: undefined,
};

/**
 * Default unified filters.
 */
export const DEFAULT_UNIFIED_FILTERS: UnifiedSearchFilters = {
  scope: "all",
  emailFilters: undefined,
  contactFilters: undefined,
};

/**
 * API response for unified search.
 */
export interface UnifiedSearchResponse {
  status: "success" | "error";
  query: string;
  scope: SearchScope;
  emails: EmailMessage[];
  contacts: Contact[];
  events?: CalendarEvent[];
  total: number;
  message?: string;
}

/**
 * API response for search suggestions.
 */
export interface SearchSuggestionsResponse {
  status: "success" | "error";
  suggestions: SearchSuggestion[];
  message?: string;
}

/**
 * Advanced search filter options for refined email search.
 */
export interface AdvancedSearchFilters {
  /** Filter by sender email/name */
  from?: string;
  /** Filter by recipient email/name */
  to?: string;
  /** Filter by subject keywords */
  subject?: string;
  /** Filter emails with attachments only */
  hasAttachments?: boolean;
  /** Filter by date range */
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  /** Filter by read/unread status */
  readStatus?: "all" | "read" | "unread";
  /** Filter by starred status */
  starred?: boolean;
  /** Filter by folder/label */
  folder?: string;
}

/**
 * Search suggestion item displayed in the dropdown.
 */
export interface SearchSuggestion {
  /** Unique identifier for the suggestion */
  id: string | number;
  /** Type of suggestion */
  type: "email" | "contact" | "calendar" | "folder" | "recent";
  /** Main display text (sender name or search term) */
  title: string;
  /** Secondary text (subject snippet or email address) */
  subtitle?: string;
  /** Formatted date string */
  date?: string;
  /** Reference to the full email message (if type is 'email') */
  message?: EmailMessage;
  /** Reference to the contact (if type is 'contact') */
  contact?: Contact;
  /** Reference to the calendar event (if type is 'calendar') */
  event?: CalendarEvent;
  /** Full data from API */
  data?: EmailMessage | Contact | CalendarEvent;
}

/**
 * Props for the SearchTrigger component.
 */
export interface SearchTriggerProps {
  /** Additional CSS class names */
  className?: string;
  /** Placeholder text for the search trigger */
  placeholder?: string;
}

/**
 * Props for the SearchCommandMenu component.
 */
export interface SearchCommandMenuProps {
  /** Additional CSS class names */
  className?: string;
}

/**
 * Default empty filters object.
 */
export const DEFAULT_SEARCH_FILTERS: AdvancedSearchFilters = {
  from: undefined,
  to: undefined,
  subject: undefined,
  hasAttachments: undefined,
  dateRange: undefined,
  readStatus: "all",
  starred: undefined,
  folder: undefined,
};

/**
 * Check if any advanced filters are active.
 */
export function hasActiveFilters(filters: AdvancedSearchFilters): boolean {
  return !!(
    filters.from ||
    filters.to ||
    filters.subject ||
    filters.hasAttachments ||
    filters.dateRange?.start ||
    filters.dateRange?.end ||
    (filters.readStatus && filters.readStatus !== "all") ||
    filters.starred ||
    filters.folder
  );
}

/**
 * Get a list of active filter labels for display.
 */
export function getActiveFilterLabels(
  filters: AdvancedSearchFilters,
): string[] {
  const labels: string[] = [];

  if (filters.from) labels.push(`From: ${filters.from}`);
  if (filters.to) labels.push(`To: ${filters.to}`);
  if (filters.subject) labels.push(`Subject: ${filters.subject}`);
  if (filters.hasAttachments) labels.push("Has attachments");
  if (filters.readStatus === "read") labels.push("Read");
  if (filters.readStatus === "unread") labels.push("Unread");
  if (filters.starred) labels.push("Starred");
  if (filters.folder) labels.push(`Folder: ${filters.folder}`);
  if (filters.dateRange?.start || filters.dateRange?.end) {
    const start = filters.dateRange.start
      ? filters.dateRange.start.toLocaleDateString()
      : "any";
    const end = filters.dateRange.end
      ? filters.dateRange.end.toLocaleDateString()
      : "any";
    labels.push(`Date: ${start} - ${end}`);
  }

  return labels;
}
