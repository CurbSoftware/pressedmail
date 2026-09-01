/**
 * Search Hooks
 *
 * TanStack Query hooks for unified search functionality.
 *
 * @since 1.4.0
 * @updated 2.1.0 - Added feature-based filtering for Free edition
 */

import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, useMemo } from "react";
import { unifiedSearch, getSearchSuggestions } from "@/services/search.service";
import { useFeatureAvailable } from "@/context/features/FeaturesContext";
import type {
  SearchScope,
  SearchSuggestion,
  UnifiedSearchResponse,
  AdvancedSearchFilters,
  ContactSearchFilters,
} from "@/types/search";
import {
  DEFAULT_SEARCH_FILTERS,
  DEFAULT_CONTACT_FILTERS,
} from "@/types/search";

/**
 * Hook for unified search with TanStack Query.
 */
export function useUnifiedSearch(
  query: string,
  scope: SearchScope = "all",
  accountId?: number,
  options?: {
    enabled?: boolean;
    limit?: number;
  },
) {
  const { enabled = true, limit = 20 } = options ?? {};

  return useQuery({
    queryKey: ["search", "unified", query, scope, accountId, limit],
    queryFn: () => unifiedSearch(query, scope, accountId, limit),
    enabled: enabled && query.length >= 2,
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook for search suggestions (autocomplete).
 */
export function useSearchSuggestions(
  query: string,
  accountId?: number,
  options?: {
    enabled?: boolean;
  },
) {
  const { enabled = true } = options ?? {};

  return useQuery({
    queryKey: ["search", "suggestions", query, accountId],
    queryFn: () => getSearchSuggestions(query, accountId),
    enabled: enabled && query.length >= 2,
    staleTime: 1000 * 15, // 15 seconds
    gcTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for managing search state with filters and scope.
 */
export function useSearchState(initialAccountId?: number) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [emailFilters, setEmailFilters] = useState<AdvancedSearchFilters>(
    DEFAULT_SEARCH_FILTERS,
  );
  const [contactFilters, setContactFilters] = useState<ContactSearchFilters>(
    DEFAULT_CONTACT_FILTERS,
  );
  const [accountId, setAccountId] = useState<number | undefined>(
    initialAccountId,
  );
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Debounce the search term
  const updateDebouncedTerm = useCallback((term: string) => {
    const timer = setTimeout(() => setDebouncedTerm(term), 300);
    return () => clearTimeout(timer);
  }, []);

  // Update search term with debounce
  const updateSearchTerm = useCallback(
    (term: string) => {
      setSearchTerm(term);
      updateDebouncedTerm(term);
    },
    [updateDebouncedTerm],
  );

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchTerm("");
    setDebouncedTerm("");
    setShowSuggestions(false);
  }, []);

  // Reset filters
  const resetFilters = useCallback(() => {
    setEmailFilters(DEFAULT_SEARCH_FILTERS);
    setContactFilters(DEFAULT_CONTACT_FILTERS);
  }, []);

  // Update a single email filter
  const updateEmailFilter = useCallback(
    <K extends keyof AdvancedSearchFilters>(
      key: K,
      value: AdvancedSearchFilters[K],
    ) => {
      setEmailFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Update a single contact filter
  const updateContactFilter = useCallback(
    <K extends keyof ContactSearchFilters>(
      key: K,
      value: ContactSearchFilters[K],
    ) => {
      setContactFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Check if any filters are active
  const hasActiveEmailFilters = useMemo(() => {
    return !!(
      emailFilters.from ||
      emailFilters.to ||
      emailFilters.subject ||
      emailFilters.hasAttachments ||
      emailFilters.dateRange?.start ||
      emailFilters.dateRange?.end ||
      (emailFilters.readStatus && emailFilters.readStatus !== "all") ||
      emailFilters.starred ||
      emailFilters.folder
    );
  }, [emailFilters]);

  const hasActiveContactFilters = useMemo(() => {
    return !!(
      contactFilters.name ||
      contactFilters.email ||
      contactFilters.company ||
      contactFilters.listId ||
      contactFilters.hasPhone ||
      contactFilters.createdAfter ||
      contactFilters.createdBefore
    );
  }, [contactFilters]);

  const hasActiveFilters = hasActiveEmailFilters || hasActiveContactFilters;

  // Get filter count
  const filterCount = useMemo(() => {
    let count = 0;
    if (emailFilters.from) count++;
    if (emailFilters.to) count++;
    if (emailFilters.subject) count++;
    if (emailFilters.hasAttachments) count++;
    if (emailFilters.dateRange?.start || emailFilters.dateRange?.end) count++;
    if (emailFilters.readStatus && emailFilters.readStatus !== "all") count++;
    if (emailFilters.starred) count++;
    if (emailFilters.folder) count++;
    if (contactFilters.name) count++;
    if (contactFilters.email) count++;
    if (contactFilters.company) count++;
    if (contactFilters.listId) count++;
    if (contactFilters.hasPhone) count++;
    if (contactFilters.createdAfter || contactFilters.createdBefore) count++;
    return count;
  }, [emailFilters, contactFilters]);

  return {
    // State
    searchTerm,
    debouncedTerm,
    scope,
    emailFilters,
    contactFilters,
    accountId,
    showSuggestions,
    hasActiveFilters,
    hasActiveEmailFilters,
    hasActiveContactFilters,
    filterCount,

    // Setters
    setSearchTerm: updateSearchTerm,
    setScope,
    setEmailFilters,
    setContactFilters,
    setAccountId,
    setShowSuggestions,

    // Actions
    clearSearch,
    resetFilters,
    updateEmailFilter,
    updateContactFilter,
  };
}

/**
 * Combined hook that provides search state and query results.
 */
export function useSearch(initialAccountId?: number) {
  const state = useSearchState(initialAccountId);
  const contactsAvailable = useFeatureAvailable("contacts");
  const calendarAvailable = useFeatureAvailable("calendar");

  // Determine the effective scope based on feature availability
  const effectiveScope = useMemo(() => {
    if (state.scope === "contacts" && !contactsAvailable) {
      return "emails"; // Fall back to emails only if contacts not available
    }
    if (state.scope === "calendar" && !calendarAvailable) {
      return "emails"; // Fall back to emails only if calendar not available
    }
    return state.scope;
  }, [state.scope, calendarAvailable, contactsAvailable]);

  // Unified search query
  const searchQuery = useUnifiedSearch(
    state.debouncedTerm,
    effectiveScope,
    state.accountId,
    { enabled: state.debouncedTerm.length >= 2 },
  );

  // Suggestions query
  const suggestionsQuery = useSearchSuggestions(
    state.debouncedTerm,
    state.accountId,
    { enabled: state.showSuggestions && state.debouncedTerm.length >= 2 },
  );

  // Get suggestions as array, filtering out unavailable feature scopes.
  const suggestions: SearchSuggestion[] = useMemo(() => {
    if (!suggestionsQuery.data?.suggestions) return [];

    let allSuggestions = suggestionsQuery.data.suggestions;

    if (!contactsAvailable) {
      allSuggestions = allSuggestions.filter(
        (suggestion) => suggestion.type !== "contact",
      );
    }

    if (!calendarAvailable) {
      allSuggestions = allSuggestions.filter(
        (suggestion) => suggestion.type !== "calendar",
      );
    }

    return allSuggestions;
  }, [suggestionsQuery.data, calendarAvailable, contactsAvailable]);

  // Get search results, filtering out unavailable feature scopes.
  const searchResults: UnifiedSearchResponse | undefined = useMemo(() => {
    if (!searchQuery.data) return undefined;

    if (!contactsAvailable && !calendarAvailable) {
      return {
        ...searchQuery.data,
        contacts: [],
        events: [],
        total: searchQuery.data.emails.length,
      };
    }

    if (!contactsAvailable) {
      const events = searchQuery.data.events ?? [];
      return {
        ...searchQuery.data,
        contacts: [],
        events,
        total: searchQuery.data.emails.length + events.length,
      };
    }

    if (!calendarAvailable) {
      return {
        ...searchQuery.data,
        events: [],
        total:
          searchQuery.data.emails.length + searchQuery.data.contacts.length,
      };
    }

    return searchQuery.data;
  }, [searchQuery.data, calendarAvailable, contactsAvailable]);

  return {
    ...state,

    // Query states
    isSearching: searchQuery.isFetching,
    isLoadingSuggestions: suggestionsQuery.isFetching,
    searchError: searchQuery.error,
    suggestionsError: suggestionsQuery.error,

    // Results
    searchResults,
    suggestions,
    emails: searchResults?.emails ?? [],
    contacts: searchResults?.contacts ?? [],
    events: searchResults?.events ?? [],
    totalResults: searchResults?.total ?? 0,

    // Refetch
    refetchSearch: searchQuery.refetch,
    refetchSuggestions: suggestionsQuery.refetch,
  };
}

export default useSearch;
