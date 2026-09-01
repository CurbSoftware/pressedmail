/**
 * Unified Search Service
 *
 * Service for searching emails and contacts via the API.
 *
 * @since 1.4.0
 */

import { routeApiPrefix, buildApiUrl } from "@/context/Strings";
import { apiFetch } from "@/lib/api-client";
import { getMailboxSourceRequestParams } from "@/lib/mailbox-source";
import type {
  SearchScope,
  UnifiedSearchResponse,
  SearchSuggestionsResponse,
} from "@/types/search";

/**
 * Get API headers including WordPress nonce.
 */
const getApiHeaders = (): HeadersInit => ({
  "Content-Type": "application/json",
});

/**
 * Search emails and/or contacts based on scope.
 */
export async function unifiedSearch(
  query: string,
  scope: SearchScope = "all",
  accountId?: number,
  limit = 20,
): Promise<UnifiedSearchResponse> {
  const url = buildApiUrl(`${routeApiPrefix}/search`, {
    q: query,
    scope,
    account_id: accountId,
    limit,
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

  return response.json();
}

/**
 * Get search suggestions for autocomplete.
 */
export async function getSearchSuggestions(
  query: string,
  accountId?: number,
): Promise<SearchSuggestionsResponse> {
  const url = buildApiUrl(`${routeApiPrefix}/search/suggestions`, {
    q: query,
    account_id: accountId,
    ...getMailboxSourceRequestParams(),
  });

  const response = await apiFetch(url, {
    method: "GET",
    credentials: "include",
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get suggestions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Search only emails.
 */
export async function searchEmails(
  query: string,
  accountId: number,
  limit = 20,
): Promise<UnifiedSearchResponse> {
  return unifiedSearch(query, "emails", accountId, limit);
}

/**
 * Search only contacts.
 */
export async function searchContacts(
  query: string,
  limit = 20,
): Promise<UnifiedSearchResponse> {
  return unifiedSearch(query, "contacts", undefined, limit);
}

export default {
  unifiedSearch,
  getSearchSuggestions,
  searchEmails,
  searchContacts,
};
