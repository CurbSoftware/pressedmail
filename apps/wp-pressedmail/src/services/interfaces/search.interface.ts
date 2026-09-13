/**
 * Search Service Interface
 *
 * Advanced search and filtering contracts.
 * Supports client-side filtering, server-side search, and search suggestions.
 *
 * @since 2.0.0
 */

import type { EmailMessage } from "@/types";
import type {
  AdvancedSearchFilters,
  SearchSuggestion,
  SearchScope,
  UnifiedSearchResponse,
} from "@/types/search";
import type { Contact } from "@/types/contacts";

/**
 * Search result with metadata.
 */
export interface SearchResult {
  /** Search failure, distinct from a successful empty result. */
  error?: string;
  /** Matching messages */
  messages: EmailMessage[];
  /** Total count (may be more than returned if paginated) */
  total: number;
  /** Search suggestions based on query */
  suggestions: SearchSuggestion[];
  /** Time taken for search in milliseconds */
  searchTime?: number;
  /** Whether results are from cache */
  fromCache?: boolean;
}

/**
 * Options for search operations.
 */
export interface SearchOptions {
  /** Account ID (optional, searches all accounts if omitted) */
  accountId?: string | number;
  /** Folder to search within (optional) */
  folder?: string;
  /** Restrict the result set by read state. */
  readStatus?: "read" | "unread";
  /** Maximum results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Include message body in search (slower) */
  includeBody?: boolean;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Server search request.
 */
export interface ServerSearchRequest {
  /** Search query string */
  query: string;
  /** Search scope */
  scope: SearchScope;
  /** Account ID (optional) */
  accountId?: number;
  /** Advanced filters */
  filters?: AdvancedSearchFilters;
  /** Maximum results */
  limit?: number;
}

/**
 * ISearchService Interface
 *
 * Advanced search and filtering operations.
 * Supports both client-side filtering and server-side search.
 */
export interface ISearchService {
  // ============== State Accessors ==============

  /** Current search term */
  readonly searchTerm: string;

  /** Current advanced filters */
  readonly filters: AdvancedSearchFilters;

  /** Current search suggestions */
  readonly suggestions: SearchSuggestion[];

  /** Whether a search is in progress */
  readonly isSearching: boolean;

  /** Last search results */
  readonly lastResults: SearchResult | null;

  // ============== Client-Side Search ==============

  /**
   * Search messages client-side.
   * Filters the provided messages array based on term and filters.
   *
   * @param messages - Messages to search within
   * @param term - Search term
   * @param filters - Advanced filters to apply
   * @returns Filtered messages
   */
  searchLocal(
    messages: EmailMessage[],
    term: string,
    filters?: AdvancedSearchFilters,
  ): EmailMessage[];

  /**
   * Apply filters to messages without search term.
   *
   * @param messages - Messages to filter
   * @param filters - Filters to apply
   * @returns Filtered messages
   */
  filterLocal(
    messages: EmailMessage[],
    filters: AdvancedSearchFilters,
  ): EmailMessage[];

  // ============== Server-Side Search ==============

  /**
   * Search messages on the server.
   * Supports full-text search across all message content.
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Search results
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult>;

  /**
   * Advanced search with filters.
   *
   * @param term - Search term
   * @param filters - Advanced filters
   * @param options - Search options
   * @returns Search results
   */
  advancedSearch(
    term: string,
    filters: AdvancedSearchFilters,
    options?: SearchOptions,
  ): Promise<SearchResult>;

  /**
   * Unified search across emails and contacts.
   *
   * @param query - Search query
   * @param scope - Search scope (all, emails, contacts)
   * @param accountId - Account ID (optional)
   * @returns Unified search response
   */
  unifiedSearch(
    query: string,
    scope: SearchScope,
    accountId?: number,
  ): Promise<UnifiedSearchResponse>;

  // ============== Search Suggestions ==============

  /**
   * Get search suggestions based on partial query.
   * Returns matching emails, contacts, calendar events, folders, and recent searches.
   *
   * @param term - Partial search term
   * @param limit - Maximum suggestions to return
   * @param scope - Limit suggestions to a single scope (default: "all")
   * @returns Array of suggestions
   */
  getSuggestions(
    term: string,
    limit?: number,
    scope?: SearchScope,
  ): Promise<SearchSuggestion[]>;

  /**
   * Get recent searches.
   *
   * @param limit - Maximum to return
   * @returns Recent search terms
   */
  getRecentSearches(limit?: number): string[];

  /**
   * Add a search to recent history.
   *
   * @param term - Search term to add
   */
  addToRecentSearches(term: string): void;

  /**
   * Clear recent search history.
   */
  clearRecentSearches(): void;

  // ============== State Management ==============

  /**
   * Set the current search term.
   * Does not trigger a search - use search() for that.
   *
   * @param term - New search term
   */
  setSearchTerm(term: string): void;

  /**
   * Set advanced filters.
   *
   * @param filters - New filter values
   */
  setFilters(filters: AdvancedSearchFilters): void;

  /**
   * Update specific filter values.
   *
   * @param updates - Partial filter updates
   */
  updateFilters(updates: Partial<AdvancedSearchFilters>): void;

  /**
   * Clear search term and filters.
   */
  clearSearch(): void;

  /**
   * Check if any filters are currently active.
   *
   * @returns True if filters are active
   */
  hasActiveFilters(): boolean;

  /**
   * Get labels for active filters (for UI chips).
   *
   * @returns Array of filter label strings
   */
  getActiveFilterLabels(): string[];

  // ============== Search Operators ==============

  /**
   * Parse a search query with operators.
   * Supports Gmail-style operators like from:, to:, subject:, has:attachment, etc.
   *
   * @param query - Query string with operators
   * @returns Parsed filters object
   */
  parseSearchQuery(query: string): AdvancedSearchFilters;

  /**
   * Build a query string from filters.
   * Inverse of parseSearchQuery.
   *
   * @param filters - Filters to convert
   * @returns Query string with operators
   */
  buildQueryString(filters: AdvancedSearchFilters): string;

  /**
   * Check if a query contains search operators.
   *
   * @param query - Query to check
   * @returns True if operators are present
   */
  hasSearchOperators(query: string): boolean;
}
