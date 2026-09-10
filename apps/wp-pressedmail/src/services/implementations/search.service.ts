import {
  getPrincipalStorageItem,
  setPrincipalStorageItem,
} from "@/lib/principal-storage";
/**
 * Search Service Implementation
 *
 * Advanced search and filtering functionality.
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
  SearchSuggestionsResponse,
} from "@/types/search";
import type {
  ISearchService,
  SearchResult,
  SearchOptions,
} from "../interfaces";
import { routeApiPrefix, buildApiUrl } from "@/context/Strings";
import { apiFetch } from "@/lib/api-client";
import { getMailboxSourceRequestParams } from "@/lib/mailbox-source";
import {
  DEFAULT_SEARCH_FILTERS,
  hasActiveFilters as checkActiveFilters,
  getActiveFilterLabels as getFilterLabels,
} from "@/types/search";
import { parseEmailDate } from "@/lib/email-date";

/**
 * Storage key for recent searches.
 */
const RECENT_SEARCHES_KEY = "pressedmail-recent-searches";
const MAX_RECENT_SEARCHES = 10;

/**
 * Get API headers including WordPress nonce.
 */
function getApiHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
  };
}

function stringifyField(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(stringifyField).join(" ");
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function formatSearchableDate(value: unknown): string {
  const raw = stringifyField(value);
  if (!raw) {
    return "";
  }

  const date = parseEmailDate(raw);
  if (!date) {
    return raw;
  }

  return [
    raw,
    date.toISOString(),
    date.toLocaleString(),
    date.toLocaleDateString(),
    date.toLocaleTimeString(),
  ].join(" ");
}

function getSearchableMessageText(msg: EmailMessage): string {
  return [
    msg.id,
    msg.uid,
    msg.msg_no,
    msg.messageId,
    msg.consolidatedUid,
    msg.subject,
    msg.from,
    msg.email,
    msg.name,
    msg.to,
    msg.cc,
    msg.bcc,
    msg.accountEmail,
    msg.accountLabel,
    msg.folder,
    msg.folderLabel,
    formatSearchableDate(msg.receivedDate ?? msg.date),
    msg.snippet,
    msg.preview,
    msg.body,
    msg.htmlBody,
    msg.textBody,
    msg.text,
    msg.plainBody,
  ]
    .map(stringifyField)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Search operators for query parsing.
 */
const SEARCH_OPERATORS = [
  "from:",
  "to:",
  "subject:",
  "has:attachment",
  "is:read",
  "is:unread",
  "is:starred",
  "in:",
  "folder:",
  "after:",
  "before:",
];

/**
 * Search Service Implementation
 *
 * Implements ISearchService for advanced search and filtering.
 */
export class SearchService implements ISearchService {
  // Internal state
  private _searchTerm = "";
  private _filters: AdvancedSearchFilters = { ...DEFAULT_SEARCH_FILTERS };
  private _suggestions: SearchSuggestion[] = [];
  private _isSearching = false;
  private _lastResults: SearchResult | null = null;
  private _recentSearches: string[] = [];

  constructor() {
    this.loadRecentSearches();
  }

  // ============== State Accessors ==============

  get searchTerm(): string {
    return this._searchTerm;
  }

  get filters(): AdvancedSearchFilters {
    return { ...this._filters };
  }

  get suggestions(): SearchSuggestion[] {
    return this._suggestions;
  }

  get isSearching(): boolean {
    return this._isSearching;
  }

  get lastResults(): SearchResult | null {
    return this._lastResults;
  }

  // ============== Client-Side Search ==============

  searchLocal(
    messages: EmailMessage[],
    term: string,
    filters?: AdvancedSearchFilters,
  ): EmailMessage[] {
    const searchFilters = filters ?? this._filters;
    const searchTerm = term.toLowerCase().trim();

    return messages.filter((msg) => {
      // Apply text search
      if (searchTerm) {
        if (!getSearchableMessageText(msg).includes(searchTerm)) {
          return false;
        }
      }

      // Apply filters
      return this.matchesFilters(msg, searchFilters);
    });
  }

  filterLocal(
    messages: EmailMessage[],
    filters: AdvancedSearchFilters,
  ): EmailMessage[] {
    return messages.filter((msg) => this.matchesFilters(msg, filters));
  }

  /**
   * Check if a message matches the given filters.
   */
  private matchesFilters(
    msg: EmailMessage,
    filters: AdvancedSearchFilters,
  ): boolean {
    // From filter
    if (filters.from) {
      const fromLower = filters.from.toLowerCase();
      const msgFrom = (msg.from || msg.email || "").toLowerCase();
      if (!msgFrom.includes(fromLower)) return false;
    }

    // To filter
    if (filters.to) {
      const toLower = filters.to.toLowerCase();
      const msgTo = Array.isArray(msg.to) ? msg.to.join(" ") : msg.to || "";
      if (!msgTo.toLowerCase().includes(toLower)) return false;
    }

    // Subject filter
    if (filters.subject) {
      const subjectLower = filters.subject.toLowerCase();
      const msgSubject = (msg.subject || "").toLowerCase();
      if (!msgSubject.includes(subjectLower)) return false;
    }

    // Has attachments filter
    if (filters.hasAttachments !== undefined) {
      const hasAtt = Boolean(msg.hasAttachments || msg.attachments?.length);
      if (hasAtt !== filters.hasAttachments) return false;
    }

    // Read status filter
    if (filters.readStatus === "read" && !msg.read) return false;
    if (filters.readStatus === "unread" && msg.read) return false;

    // Starred filter
    if (filters.starred !== undefined && msg.starred !== filters.starred) {
      return false;
    }

    // Date range filter
    if (filters.dateRange) {
      const msgDate = parseEmailDate(msg.receivedDate ?? msg.date);
      if (!msgDate) return false;
      if (filters.dateRange.start && msgDate < filters.dateRange.start) {
        return false;
      }
      if (filters.dateRange.end && msgDate > filters.dateRange.end) {
        return false;
      }
    }

    // Folder filter
    if (filters.folder) {
      const msgFolder = (msg.folder || "INBOX").toLowerCase();
      if (msgFolder !== filters.folder.toLowerCase()) return false;
    }

    return true;
  }

  // ============== Server-Side Search ==============

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const startTime = Date.now();
    this._isSearching = true;

    try {
      const url = buildApiUrl(`${routeApiPrefix}/search`, {
        q: query,
        scope: "emails",
        account_id: options?.accountId,
        folder: options?.folder,
        limit: options?.limit ?? 25,
        offset: options?.offset ?? 0,
        ...getMailboxSourceRequestParams(),
      });

      const response = await apiFetch(url, {
        method: "GET",
        credentials: "include",
        headers: getApiHeaders(),
        signal: options?.signal,
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data: UnifiedSearchResponse = await response.json();

      const result: SearchResult = {
        messages: data.emails || [],
        total: data.total || data.emails?.length || 0,
        suggestions: [],
        searchTime: Date.now() - startTime,
        fromCache: false,
      };

      this._lastResults = result;

      // Add to recent searches if successful
      if (query.trim()) {
        this.addToRecentSearches(query);
      }

      return result;
    } catch (error) {
      console.error("[SearchService] search error:", error);
      return {
        messages: [],
        total: 0,
        suggestions: [],
        searchTime: Date.now() - startTime,
      };
    } finally {
      this._isSearching = false;
    }
  }

  async advancedSearch(
    term: string,
    filters: AdvancedSearchFilters,
    options?: SearchOptions,
  ): Promise<SearchResult> {
    // Build query string from term and filters
    const queryParts: string[] = [];

    if (term) queryParts.push(term);
    if (filters.from) queryParts.push(`from:${filters.from}`);
    if (filters.to) queryParts.push(`to:${filters.to}`);
    if (filters.subject) queryParts.push(`subject:${filters.subject}`);
    if (filters.hasAttachments) queryParts.push("has:attachment");
    if (filters.readStatus === "read") queryParts.push("is:read");
    if (filters.readStatus === "unread") queryParts.push("is:unread");
    if (filters.starred) queryParts.push("is:starred");
    if (filters.folder) queryParts.push(`in:${filters.folder}`);
    if (filters.dateRange?.start) {
      queryParts.push(
        `after:${filters.dateRange.start.toISOString().split("T")[0]}`,
      );
    }
    if (filters.dateRange?.end) {
      queryParts.push(
        `before:${filters.dateRange.end.toISOString().split("T")[0]}`,
      );
    }

    const fullQuery = queryParts.join(" ");
    return this.search(fullQuery, options);
  }

  async unifiedSearch(
    query: string,
    scope: SearchScope,
    accountId?: number,
  ): Promise<UnifiedSearchResponse> {
    this._isSearching = true;

    try {
      const url = buildApiUrl(`${routeApiPrefix}/search`, {
        q: query,
        scope,
        account_id: accountId,
        limit: 20,
        ...getMailboxSourceRequestParams(),
      });

      const response = await apiFetch(url, {
        method: "GET",
        credentials: "include",
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data: UnifiedSearchResponse = await response.json();

      // Add to recent searches
      if (query.trim()) {
        this.addToRecentSearches(query);
      }

      return data;
    } catch (error) {
      console.error("[SearchService] unifiedSearch error:", error);
      return {
        status: "error",
        query,
        scope,
        emails: [],
        contacts: [],
        total: 0,
        message: error instanceof Error ? error.message : "Search failed",
      };
    } finally {
      this._isSearching = false;
    }
  }

  // ============== Search Suggestions ==============

  async getSuggestions(
    term: string,
    limit = 5,
    scope: SearchScope = "all",
  ): Promise<SearchSuggestion[]> {
    if (!term || term.length < 2) {
      return [];
    }

    try {
      const url = buildApiUrl(`${routeApiPrefix}/search/suggestions`, {
        q: term,
        scope,
        ...getMailboxSourceRequestParams(),
      });

      const response = await apiFetch(url, {
        method: "GET",
        credentials: "include",
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        return [];
      }

      const data: SearchSuggestionsResponse = await response.json();
      this._suggestions = data.suggestions?.slice(0, limit) ?? [];
      return this._suggestions;
    } catch (error) {
      console.error("[SearchService] getSuggestions error:", error);
      return [];
    }
  }

  getRecentSearches(limit = 5): string[] {
    return this._recentSearches.slice(0, limit);
  }

  addToRecentSearches(term: string): void {
    const trimmed = term.trim();
    if (!trimmed) return;

    // Remove if already exists (will be added at front)
    this._recentSearches = this._recentSearches.filter(
      (s) => s.toLowerCase() !== trimmed.toLowerCase(),
    );

    // Add at front
    this._recentSearches.unshift(trimmed);

    // Limit size
    if (this._recentSearches.length > MAX_RECENT_SEARCHES) {
      this._recentSearches = this._recentSearches.slice(0, MAX_RECENT_SEARCHES);
    }

    this.saveRecentSearches();
  }

  clearRecentSearches(): void {
    this._recentSearches = [];
    this.saveRecentSearches();
  }

  // ============== State Management ==============

  setSearchTerm(term: string): void {
    this._searchTerm = term;
  }

  setFilters(filters: AdvancedSearchFilters): void {
    this._filters = { ...filters };
  }

  updateFilters(updates: Partial<AdvancedSearchFilters>): void {
    this._filters = { ...this._filters, ...updates };
  }

  clearSearch(): void {
    this._searchTerm = "";
    this._filters = { ...DEFAULT_SEARCH_FILTERS };
    this._suggestions = [];
    this._lastResults = null;
  }

  hasActiveFilters(): boolean {
    return checkActiveFilters(this._filters);
  }

  getActiveFilterLabels(): string[] {
    return getFilterLabels(this._filters);
  }

  // ============== Search Operators ==============

  parseSearchQuery(query: string): AdvancedSearchFilters {
    const filters: AdvancedSearchFilters = { ...DEFAULT_SEARCH_FILTERS };

    // Parse from:
    const fromMatch = query.match(/from:["']?([^"'\s]+)["']?/i);
    if (fromMatch) filters.from = fromMatch[1];

    // Parse to:
    const toMatch = query.match(/to:["']?([^"'\s]+)["']?/i);
    if (toMatch) filters.to = toMatch[1];

    // Parse subject:
    const subjectMatch = query.match(/subject:["']([^"']+)["']|subject:(\S+)/i);
    if (subjectMatch) filters.subject = subjectMatch[1] || subjectMatch[2];

    // Parse has:attachment
    if (/has:attachment/i.test(query)) {
      filters.hasAttachments = true;
    }

    // Parse is:read
    if (/is:read/i.test(query)) {
      filters.readStatus = "read";
    }

    // Parse is:unread
    if (/is:unread/i.test(query)) {
      filters.readStatus = "unread";
    }

    // Parse is:starred
    if (/is:starred/i.test(query)) {
      filters.starred = true;
    }

    // Parse in: or folder:
    const folderMatch = query.match(/(?:in|folder):["']?([^"'\s]+)["']?/i);
    if (folderMatch) filters.folder = folderMatch[1];

    // Parse after:
    const afterMatch = query.match(/after:(\d{4}-\d{2}-\d{2})/i);
    if (afterMatch?.[1]) {
      if (!filters.dateRange) filters.dateRange = {};
      filters.dateRange.start = new Date(afterMatch[1]);
    }

    // Parse before:
    const beforeMatch = query.match(/before:(\d{4}-\d{2}-\d{2})/i);
    if (beforeMatch?.[1]) {
      if (!filters.dateRange) filters.dateRange = {};
      filters.dateRange.end = new Date(beforeMatch[1]);
    }

    return filters;
  }

  buildQueryString(filters: AdvancedSearchFilters): string {
    const parts: string[] = [];

    if (filters.from) parts.push(`from:${filters.from}`);
    if (filters.to) parts.push(`to:${filters.to}`);
    if (filters.subject) {
      // Quote if contains spaces
      const subj = filters.subject.includes(" ")
        ? `"${filters.subject}"`
        : filters.subject;
      parts.push(`subject:${subj}`);
    }
    if (filters.hasAttachments) parts.push("has:attachment");
    if (filters.readStatus === "read") parts.push("is:read");
    if (filters.readStatus === "unread") parts.push("is:unread");
    if (filters.starred) parts.push("is:starred");
    if (filters.folder) parts.push(`in:${filters.folder}`);
    if (filters.dateRange?.start) {
      parts.push(
        `after:${filters.dateRange.start.toISOString().split("T")[0]}`,
      );
    }
    if (filters.dateRange?.end) {
      parts.push(`before:${filters.dateRange.end.toISOString().split("T")[0]}`);
    }

    return parts.join(" ");
  }

  hasSearchOperators(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    return SEARCH_OPERATORS.some((op) => lowerQuery.includes(op));
  }

  // ============== Private Helpers ==============

  private loadRecentSearches(): void {
    if (typeof window === "undefined") return;

    try {
      const stored = getPrincipalStorageItem("local", RECENT_SEARCHES_KEY);
      if (stored) {
        this._recentSearches = JSON.parse(stored);
      }
    } catch (error) {
      console.warn("[SearchService] Failed to load recent searches:", error);
    }
  }

  private saveRecentSearches(): void {
    if (typeof window === "undefined") return;

    try {
      setPrincipalStorageItem(
        "local",
        RECENT_SEARCHES_KEY,
        JSON.stringify(this._recentSearches),
      );
    } catch (error) {
      console.warn("[SearchService] Failed to save recent searches:", error);
    }
  }

  /**
   * Reset the service state.
   */
  reset(): void {
    this._searchTerm = "";
    this._filters = { ...DEFAULT_SEARCH_FILTERS };
    this._suggestions = [];
    this._isSearching = false;
    this._lastResults = null;
  }
}

/**
 * Singleton instance for shared search operations.
 */
let searchServiceInstance: SearchService | null = null;

/**
 * Get the shared SearchService instance.
 */
export function getSearchService(): SearchService {
  if (!searchServiceInstance) {
    searchServiceInstance = new SearchService();
  }
  return searchServiceInstance;
}

/**
 * Reset the search service (mainly for testing).
 */
export function resetSearchService(): void {
  if (searchServiceInstance) {
    searchServiceInstance.reset();
  }
  searchServiceInstance = null;
}
