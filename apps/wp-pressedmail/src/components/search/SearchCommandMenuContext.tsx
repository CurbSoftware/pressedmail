"use client";

/**
 * Search Command Menu Context
 *
 * Shared state for the search trigger and command menu overlay.
 * Determines default scope from current page and bridges
 * the useSearch hook with both UI components.
 *
 * @since 3.2.0
 */

import * as React from "react";
import { useLocation } from "react-router-dom";
import { useAppContext } from "@/context/AppProvider";
import { useSearch } from "@/hooks/useSearch";
import { useFeatureAvailable } from "@/context/features/FeaturesContext";
import { DEFAULT_SEARCH_FILTERS } from "@/types/search";
import type { SearchScope, AdvancedSearchFilters } from "@/types/search";

/** Local search operations that don't depend on InboxContext */
interface SharedSearchOps {
  advancedFilters: AdvancedSearchFilters;
  setAdvancedFilters: (filters: AdvancedSearchFilters) => void;
  clearAdvancedFilters: () => void;
  clearSearch: () => void;
  executeSearch: (term?: string, filters?: AdvancedSearchFilters) => void;
  getRecentSearches: () => string[];
}

interface SearchCommandMenuContextValue {
  /** Whether the command menu is open */
  isOpen: boolean;
  /** Open the command menu */
  open: () => void;
  /** Close the command menu */
  close: () => void;
  /** Set open state directly */
  setOpen: (open: boolean) => void;
  /** Search state from useSearch hook */
  search: ReturnType<typeof useSearch>;
  /** Local search operations (no InboxContext dependency) */
  sharedOps: SharedSearchOps;
  /** Default scope based on current page */
  currentPageScope: SearchScope;
  /** Whether contacts feature is available */
  contactsAvailable: boolean;
}

const SearchCommandMenuContext =
  React.createContext<SearchCommandMenuContextValue | null>(null);

/**
 * Determine the default search scope from the current route path.
 */
function useCurrentPageScope(): SearchScope {
  const location = useLocation();
  const path = location.pathname;

  return React.useMemo(() => {
    if (path.startsWith("/contacts")) return "contacts";
    if (path.startsWith("/inbox") || path === "/" || path.startsWith("/mail")) {
      return "emails";
    }
    return "all";
  }, [path]);
}

export function SearchCommandMenuProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const currentPageScope = useCurrentPageScope();
  const contactsAvailable = useFeatureAvailable("contacts");

  // Get selected account ID for search hook
  const { selectedAccount, accounts } = useAppContext();
  const selectedAccountId = React.useMemo(() => {
    if (!selectedAccount || !accounts) return undefined;
    const account = accounts.find((a) => a.email === selectedAccount);
    if (!account?.id) return undefined;
    return typeof account.id === "string"
      ? parseInt(account.id, 10)
      : account.id;
  }, [selectedAccount, accounts]);

  const search = useSearch(selectedAccountId);

  // Local advanced-filter state, avoids dependency on InboxContext
  const [advancedFilters, setAdvancedFiltersState] =
    React.useState<AdvancedSearchFilters>(DEFAULT_SEARCH_FILTERS);

  const sharedOps: SharedSearchOps = React.useMemo(
    () => ({
      advancedFilters,
      setAdvancedFilters: setAdvancedFiltersState,
      clearAdvancedFilters: () =>
        setAdvancedFiltersState(DEFAULT_SEARCH_FILTERS),
      clearSearch: () => {
        search.clearSearch();
        setAdvancedFiltersState(DEFAULT_SEARCH_FILTERS);
      },
      executeSearch: (term?: string, filters?: AdvancedSearchFilters) => {
        if (term !== undefined) search.setSearchTerm(term);
        if (filters) setAdvancedFiltersState(filters);
        // Persist to recent searches
        try {
          const key = "pressedmail_recent_searches";
          const recent = JSON.parse(
            localStorage.getItem(key) || "[]",
          ) as string[];
          const searchTerm = term ?? search.searchTerm;
          if (searchTerm && !recent.includes(searchTerm)) {
            recent.unshift(searchTerm);
            localStorage.setItem(key, JSON.stringify(recent.slice(0, 10)));
          }
        } catch {
          /* ignore localStorage errors */
        }
      },
      getRecentSearches: (): string[] => {
        try {
          return JSON.parse(
            localStorage.getItem("pressedmail_recent_searches") || "[]",
          );
        } catch {
          return [];
        }
      },
    }),
    [advancedFilters, search],
  );

  const open = React.useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const setOpen = React.useCallback((value: boolean) => {
    setIsOpen(value);
  }, []);

  // Keyboard shortcut: "/" to open command menu (when not in an input)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName) &&
        !(e.target as HTMLElement).isContentEditable
      ) {
        e.preventDefault();
        open();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const value = React.useMemo(
    () => ({
      isOpen,
      open,
      close,
      setOpen,
      search,
      sharedOps,
      currentPageScope,
      contactsAvailable,
    }),
    [
      isOpen,
      open,
      close,
      setOpen,
      search,
      sharedOps,
      currentPageScope,
      contactsAvailable,
    ],
  );

  return (
    <SearchCommandMenuContext.Provider value={value}>
      {children}
    </SearchCommandMenuContext.Provider>
  );
}

export function useSearchCommandMenu(): SearchCommandMenuContextValue {
  const context = React.useContext(SearchCommandMenuContext);
  if (!context) {
    throw new Error(
      "useSearchCommandMenu must be used within SearchCommandMenuProvider",
    );
  }
  return context;
}
