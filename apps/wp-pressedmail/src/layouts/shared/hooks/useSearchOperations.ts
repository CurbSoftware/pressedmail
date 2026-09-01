/**
 * useSearchOperations Hook
 *
 * Shared business logic for search operations across all layouts.
 * Uses the service-based architecture from InboxContext.
 *
 * @since 2.0.0
 * @updated 2.4.0 - Migrated to service-based architecture
 * @updated 3.0.0 - Fully migrated to InboxContext (no MessagesProvider)
 */

import { useCallback, useMemo, useState } from "react";
import {
  useInbox,
  useSearchOperations as useServiceSearchOperations,
  useFilterOperations,
} from "@/context/InboxContext";
import { useContacts } from "@/context/contacts/ContactsContext";
import { useCalendar } from "@/context/calendar/CalendarContext";
import { useFeatureAvailable } from "@/context/features/FeaturesContext";
import type { AdvancedSearchFilters } from "@/types/search";
import { DEFAULT_SEARCH_FILTERS } from "@/types/search";
import type { EmailMessage } from "@/types";
import type { Contact } from "@/types/contacts";
import type { CalendarEvent, LocalCalendarEvent } from "@/types/calendar";
import { parseSenderName } from "@/lib/mail-utils";
import type { MessageFilters } from "@/services/interfaces";

export type HeaderSearchTarget = "email" | "contacts" | "events";

/**
 * Search suggestion types used by the shared header search.
 */
export interface EmailSearchSuggestion {
  id: string;
  type: "email";
  title: string;
  subtitle: string;
  date: string;
  message: EmailMessage;
}

export interface ContactSearchSuggestion {
  id: string;
  type: "contact";
  title: string;
  subtitle: string;
  date: string;
  contact: Contact;
}

export interface EventSearchSuggestion {
  id: string;
  type: "event";
  title: string;
  subtitle: string;
  date: string;
  event: CalendarEvent | LocalCalendarEvent;
}

export type SearchSuggestion =
  | EmailSearchSuggestion
  | ContactSearchSuggestion
  | EventSearchSuggestion;

/**
 * Saved search type.
 */
export interface SavedSearch {
  id: string;
  name: string;
  term: string;
  filters: AdvancedSearchFilters;
  createdAt: Date;
}

/**
 * Return type for useSearchOperations hook.
 */
export interface UseSearchOperationsReturn {
  // State
  searchTerm: string;
  advancedFilters: AdvancedSearchFilters;
  isSearching: boolean;
  savedSearches: SavedSearch[];
  availableSearchTargets: HeaderSearchTarget[];

  // Search Operations
  setSearchTerm: (term: string) => void;
  clearSearch: () => void;
  executeSearch: (term?: string, filters?: AdvancedSearchFilters) => void;

  // Advanced Filters
  setAdvancedFilters: (filters: AdvancedSearchFilters) => void;
  updateAdvancedFilter: <K extends keyof AdvancedSearchFilters>(
    key: K,
    value: AdvancedSearchFilters[K],
  ) => void;
  clearAdvancedFilters: () => void;
  hasActiveFilters: () => boolean;

  // Quick Filters
  filterByUnread: () => void;
  filterByStarred: () => void;
  filterByAttachments: () => void;
  filterByDateRange: (start: Date, end: Date) => void;
  filterBySender: (sender: string) => void;

  // Suggestions
  getSuggestions: (
    term: string,
    target?: HeaderSearchTarget,
  ) => SearchSuggestion[];
  getRecentSearches: () => string[];

  // Saved Searches
  saveSearch: (name: string) => void;
  deleteSavedSearch: (id: string) => void;
  applySavedSearch: (search: SavedSearch) => void;
}

function buildMessageFilters(
  term: string,
  filters: AdvancedSearchFilters,
): MessageFilters {
  const messageFilters: MessageFilters = {};
  const trimmedTerm = term.trim();

  if (trimmedTerm) {
    messageFilters.searchTerm = trimmedTerm;
  }

  if (filters.readStatus && filters.readStatus !== "all") {
    messageFilters.readStatus = filters.readStatus;
  }

  if (filters.hasAttachments !== undefined) {
    messageFilters.hasAttachments = filters.hasAttachments;
  }

  if (filters.starred !== undefined) {
    messageFilters.starred = filters.starred;
  }

  if (filters.from?.trim()) {
    messageFilters.from = filters.from.trim();
  }

  if (filters.to?.trim()) {
    messageFilters.to = filters.to.trim();
  }

  if (filters.subject?.trim()) {
    messageFilters.subject = filters.subject.trim();
  }

  if (filters.folder?.trim()) {
    messageFilters.folder = filters.folder.trim();
  }

  if (filters.dateRange?.start || filters.dateRange?.end) {
    messageFilters.dateRange = filters.dateRange;
  }

  return messageFilters;
}

function getContactDisplayName(contact: Contact): string {
  return (
    [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() ||
    contact.email
  );
}

function getContactSearchText(contact: Contact): string {
  return [
    contact.email,
    contact.first_name,
    contact.last_name,
    contact.company,
    contact.phone,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isLocalCalendarEvent(
  event: CalendarEvent | LocalCalendarEvent,
): event is LocalCalendarEvent {
  return "start_datetime" in event;
}

function getEventStartDate(event: CalendarEvent | LocalCalendarEvent): string {
  return isLocalCalendarEvent(event) ? event.start_datetime : event.start_date;
}

function getEventEndDate(event: CalendarEvent | LocalCalendarEvent): string {
  return isLocalCalendarEvent(event) ? event.end_datetime : event.end_date;
}

function formatEventDate(event: CalendarEvent | LocalCalendarEvent): string {
  const rawStart = getEventStartDate(event);
  if (!rawStart) return "";

  const start = new Date(rawStart);
  if (Number.isNaN(start.getTime())) return "";

  return start.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getEventSearchText(event: CalendarEvent | LocalCalendarEvent): string {
  return [
    event.title,
    event.description,
    event.location,
    getEventStartDate(event),
    getEventEndDate(event),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Hook providing shared search operations for all layout components.
 */
export function useSearchOperations(): UseSearchOperationsReturn {
  const inbox = useInbox();
  const serviceSearchOps = useServiceSearchOperations();
  const filterOps = useFilterOperations();
  const { contacts } = useContacts();
  const { events, localEvents } = useCalendar();
  const contactsAvailable = useFeatureAvailable("contacts");
  const calendarAvailable = useFeatureAvailable("calendar");

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [advancedFilters, setAdvancedFiltersState] =
    useState<AdvancedSearchFilters>(DEFAULT_SEARCH_FILTERS);

  const searchTerm = serviceSearchOps.searchTerm;
  const isSearching = serviceSearchOps.isSearching;

  const availableSearchTargets = useMemo<HeaderSearchTarget[]>(() => {
    const targets: HeaderSearchTarget[] = ["email"];
    if (contactsAvailable) targets.push("contacts");
    if (calendarAvailable) targets.push("events");
    return targets;
  }, [contactsAvailable, calendarAvailable]);

  // Search Operations
  const setSearchTerm = useCallback(
    (term: string) => {
      serviceSearchOps.setSearchTerm(term);
      filterOps.applyFilters(buildMessageFilters(term, advancedFilters));
    },
    [advancedFilters, filterOps, serviceSearchOps],
  );

  const clearSearch = useCallback(() => {
    serviceSearchOps.clearSearch();
    filterOps.clearFilters();
    setAdvancedFiltersState(DEFAULT_SEARCH_FILTERS);
  }, [serviceSearchOps, filterOps]);

  const executeSearch = useCallback(
    (term?: string, filters?: AdvancedSearchFilters) => {
      const searchTermToUse = term ?? searchTerm;
      const filtersToUse = filters ?? advancedFilters;

      serviceSearchOps.setSearchTerm(searchTermToUse);
      filterOps.applyFilters(
        buildMessageFilters(searchTermToUse, filtersToUse),
      );
    },
    [searchTerm, advancedFilters, serviceSearchOps, filterOps],
  );

  // Advanced Filters
  const setAdvancedFilters = useCallback(
    (filters: AdvancedSearchFilters) => {
      setAdvancedFiltersState(filters);
      filterOps.applyFilters(buildMessageFilters(searchTerm, filters));
    },
    [filterOps, searchTerm],
  );

  const updateAdvancedFilter = useCallback(
    <K extends keyof AdvancedSearchFilters>(
      key: K,
      value: AdvancedSearchFilters[K],
    ) => {
      setAdvancedFiltersState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const clearAdvancedFilters = useCallback(() => {
    setAdvancedFiltersState(DEFAULT_SEARCH_FILTERS);
    filterOps.applyFilters(
      buildMessageFilters(searchTerm, DEFAULT_SEARCH_FILTERS),
    );
  }, [filterOps, searchTerm]);

  const hasActiveFilters = useCallback((): boolean => {
    return (
      !!advancedFilters.from ||
      !!advancedFilters.to ||
      !!advancedFilters.subject ||
      !!advancedFilters.folder ||
      !!advancedFilters.hasAttachments ||
      !!advancedFilters.starred ||
      !!advancedFilters.dateRange?.start ||
      !!advancedFilters.dateRange?.end ||
      (!!advancedFilters.readStatus && advancedFilters.readStatus !== "all")
    );
  }, [advancedFilters]);

  // Quick Filters
  const filterByUnread = useCallback(() => {
    setAdvancedFiltersState((prev) => ({ ...prev, readStatus: "unread" }));
    filterOps.applyFilters({ readStatus: "unread" });
    executeSearch();
  }, [filterOps, executeSearch]);

  const filterByStarred = useCallback(() => {
    setAdvancedFiltersState((prev) => ({ ...prev, starred: true }));
    filterOps.applyFilters({ starred: true });
    executeSearch();
  }, [filterOps, executeSearch]);

  const filterByAttachments = useCallback(() => {
    setAdvancedFiltersState((prev) => ({ ...prev, hasAttachments: true }));
    filterOps.applyFilters({ hasAttachments: true });
    executeSearch();
  }, [filterOps, executeSearch]);

  const filterByDateRange = useCallback(
    (start: Date, end: Date) => {
      setAdvancedFiltersState((prev) => ({
        ...prev,
        dateStart: start.toISOString(),
        dateEnd: end.toISOString(),
        dateRange: { start, end },
      }));
      executeSearch();
    },
    [executeSearch],
  );

  const filterBySender = useCallback(
    (sender: string) => {
      setAdvancedFiltersState((prev) => ({ ...prev, from: sender }));
      executeSearch();
    },
    [executeSearch],
  );

  // Suggestions: local search through inbox messages
  const getSuggestions = useCallback(
    (
      term: string,
      target: HeaderSearchTarget = "email",
    ): SearchSuggestion[] => {
      if (!term.trim() || term.length < 2) return [];

      const termLower = term.toLowerCase();

      if (target === "contacts") {
        if (!contactsAvailable) return [];

        return contacts
          .filter((contact) =>
            getContactSearchText(contact).includes(termLower),
          )
          .slice(0, 8)
          .map((contact) => ({
            id: `contact-${contact.id}`,
            type: "contact" as const,
            title: getContactDisplayName(contact),
            subtitle: contact.email,
            date: contact.company || "",
            contact,
          }));
      }

      if (target === "events") {
        if (!calendarAvailable) return [];

        return [
          ...events.map((event) => ({
            id: `event-${event.id}`,
            type: "event" as const,
            title: event.title,
            subtitle: formatEventDate(event),
            date: event.location || "",
            event,
          })),
          ...localEvents.map((event) => ({
            id: `local-event-${event.id}`,
            type: "event" as const,
            title: event.title,
            subtitle: formatEventDate(event),
            date: event.location || "",
            event,
          })),
        ]
          .filter((suggestion) =>
            getEventSearchText(suggestion.event).includes(termLower),
          )
          .slice(0, 8);
      }

      const matchingMessages = inbox.messages
        .filter(
          (message) =>
            message.subject?.toLowerCase().includes(termLower) ||
            message.from?.toLowerCase().includes(termLower) ||
            (message as any).name?.toLowerCase().includes(termLower) ||
            (message as any).email?.toLowerCase().includes(termLower),
        )
        .slice(0, 8);

      return matchingMessages.map((message) => {
        const senderName = parseSenderName(message as any);

        let formattedDate: string;
        try {
          const date = new Date(message.date);
          const now = new Date();
          const isToday = date.toDateString() === now.toDateString();
          const isThisYear = date.getFullYear() === now.getFullYear();

          if (isToday) {
            formattedDate = date.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
          } else if (isThisYear) {
            formattedDate = date.toLocaleDateString([], {
              month: "short",
              day: "numeric",
            });
          } else {
            formattedDate = date.toLocaleDateString([], {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
          }
        } catch {
          formattedDate = message.date || "";
        }

        return {
          id: String(message.id),
          type: "email" as const,
          title: senderName.trim(),
          subtitle: message.subject || "(No Subject)",
          date: formattedDate,
          message,
        };
      });
    },
    [
      calendarAvailable,
      contacts,
      contactsAvailable,
      events,
      inbox.messages,
      localEvents,
    ],
  );

  // Get recent searches from service
  const getRecentSearches = useCallback((): string[] => {
    return serviceSearchOps.getRecentSearches();
  }, [serviceSearchOps]);

  // Saved Searches
  const saveSearch = useCallback(
    (name: string) => {
      const newSearch: SavedSearch = {
        id: Date.now().toString(),
        name,
        term: searchTerm,
        filters: { ...advancedFilters },
        createdAt: new Date(),
      };
      setSavedSearches((prev) => [...prev, newSearch]);
    },
    [searchTerm, advancedFilters],
  );

  const deleteSavedSearch = useCallback((id: string) => {
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const applySavedSearch = useCallback(
    (search: SavedSearch) => {
      setSearchTerm(search.term);
      setAdvancedFilters(search.filters);
      executeSearch(search.term, search.filters);
    },
    [setSearchTerm, setAdvancedFilters, executeSearch],
  );

  return useMemo(
    () => ({
      // State
      searchTerm,
      advancedFilters,
      isSearching,
      savedSearches,
      availableSearchTargets,

      // Search Operations
      setSearchTerm,
      clearSearch,
      executeSearch,

      // Advanced Filters
      setAdvancedFilters,
      updateAdvancedFilter,
      clearAdvancedFilters,
      hasActiveFilters,

      // Quick Filters
      filterByUnread,
      filterByStarred,
      filterByAttachments,
      filterByDateRange,
      filterBySender,

      // Suggestions
      getSuggestions,
      getRecentSearches,

      // Saved Searches
      saveSearch,
      deleteSavedSearch,
      applySavedSearch,
    }),
    [
      searchTerm,
      advancedFilters,
      isSearching,
      savedSearches,
      availableSearchTargets,
      setSearchTerm,
      clearSearch,
      executeSearch,
      setAdvancedFilters,
      updateAdvancedFilter,
      clearAdvancedFilters,
      hasActiveFilters,
      filterByUnread,
      filterByStarred,
      filterByAttachments,
      filterByDateRange,
      filterBySender,
      getSuggestions,
      getRecentSearches,
      saveSearch,
      deleteSavedSearch,
      applySavedSearch,
    ],
  );
}

export default useSearchOperations;
