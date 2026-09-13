"use client";

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { __ } from "@wordpress/i18n";
import { Filter, X } from "lucide-react";

import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  cn,
} from "@kit/ui/plugin";

import { useSearchOperations } from "@/layouts/shared/hooks/useSearchOperations";
import {
  DEFAULT_CALENDAR_FILTERS,
  DEFAULT_CONTACT_FILTERS,
  DEFAULT_SEARCH_FILTERS,
  getActiveFilterLabels,
  type AdvancedSearchFilters,
  type CalendarSearchFilters,
  type ContactSearchFilters,
  type HeaderSearchScope,
  type SearchSuggestion,
} from "@/types/search";
import { getSearchService } from "@/services/implementations/search.service";
import { DateTimeSelector } from "@/components/ui/date-time-selector";
import {
  SEARCH_SCOPE_OPTIONS,
  SearchScopeDropdown,
  type SearchScopeOption,
} from "./SearchScopeDropdown";

export interface HeaderSearchInputProps {
  className?: string;
  placeholder?: string;
}

interface DraftFilters {
  from: string;
  to: string;
  subject: string;
  folder: string;
  dateStart: string;
  dateEnd: string;
  readStatus: "all" | "read" | "unread";
  starred: boolean;
  hasAttachments: boolean;
}

interface DraftContactFilters {
  name: string;
  email: string;
  company: string;
  hasPhone: boolean;
}

interface DraftCalendarFilters {
  dateStart: string;
  dateEnd: string;
  allDay: boolean;
}

const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_HEADER_SEARCH_TARGETS = ["email", "contacts", "events"] as const;

const EMPTY_DRAFT_FILTERS: DraftFilters = {
  from: "",
  to: "",
  subject: "",
  folder: "",
  dateStart: "",
  dateEnd: "",
  readStatus: "all",
  starred: false,
  hasAttachments: false,
};

const EMPTY_CONTACT_DRAFT: DraftContactFilters = {
  name: "",
  email: "",
  company: "",
  hasPhone: false,
};

const EMPTY_CALENDAR_DRAFT: DraftCalendarFilters = {
  dateStart: "",
  dateEnd: "",
  allDay: false,
};

/**
 * Local calendar date as YYYY-MM-DD. toISOString() would give the UTC date,
 * so a filter built from local midnight came back a day earlier east of UTC
 * and moved again on every reopen.
 */
function toDateInputValue(date?: Date): string {
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function filtersToDraft(filters: AdvancedSearchFilters): DraftFilters {
  return {
    from: filters.from ?? "",
    to: filters.to ?? "",
    subject: filters.subject ?? "",
    folder: filters.folder ?? "",
    dateStart: toDateInputValue(filters.dateRange?.start),
    dateEnd: toDateInputValue(filters.dateRange?.end),
    readStatus: filters.readStatus ?? "all",
    starred: filters.starred === true,
    hasAttachments: filters.hasAttachments === true,
  };
}

function draftToFilters(draft: DraftFilters): AdvancedSearchFilters {
  const dateRange: AdvancedSearchFilters["dateRange"] = {};

  if (draft.dateStart) {
    dateRange.start = new Date(`${draft.dateStart}T00:00:00`);
  }

  if (draft.dateEnd) {
    dateRange.end = new Date(`${draft.dateEnd}T23:59:59`);
  }

  return {
    ...DEFAULT_SEARCH_FILTERS,
    from: draft.from.trim() || undefined,
    to: draft.to.trim() || undefined,
    subject: draft.subject.trim() || undefined,
    folder: draft.folder.trim() || undefined,
    dateRange: dateRange.start || dateRange.end ? dateRange : undefined,
    readStatus: draft.readStatus,
    starred: draft.starred || undefined,
    hasAttachments: draft.hasAttachments || undefined,
  };
}

function contactDraftToFilters(
  draft: DraftContactFilters,
): ContactSearchFilters {
  return {
    ...DEFAULT_CONTACT_FILTERS,
    name: draft.name.trim() || undefined,
    email: draft.email.trim() || undefined,
    company: draft.company.trim() || undefined,
    hasPhone: draft.hasPhone || undefined,
  };
}

function calendarDraftToFilters(
  draft: DraftCalendarFilters,
): CalendarSearchFilters {
  const dateRange: CalendarSearchFilters["dateRange"] = {};

  if (draft.dateStart) {
    dateRange.start = new Date(`${draft.dateStart}T00:00:00`);
  }

  if (draft.dateEnd) {
    dateRange.end = new Date(`${draft.dateEnd}T23:59:59`);
  }

  return {
    ...DEFAULT_CALENDAR_FILTERS,
    dateRange: dateRange.start || dateRange.end ? dateRange : undefined,
    allDay: draft.allDay || undefined,
  };
}

function getContactFilterLabels(filters: ContactSearchFilters): string[] {
  const labels: string[] = [];
  if (filters.name) labels.push(`Name: ${filters.name}`);
  if (filters.email) labels.push(`Email: ${filters.email}`);
  if (filters.company) labels.push(`Company: ${filters.company}`);
  if (filters.hasPhone) labels.push("Has phone");
  return labels;
}

function getCalendarFilterLabels(filters: CalendarSearchFilters): string[] {
  const labels: string[] = [];
  if (filters.allDay) labels.push("All-day");
  if (filters.dateRange?.start || filters.dateRange?.end) {
    const start = filters.dateRange?.start
      ? filters.dateRange.start.toLocaleDateString()
      : "any";
    const end = filters.dateRange?.end
      ? filters.dateRange.end.toLocaleDateString()
      : "any";
    labels.push(`Date: ${start} - ${end}`);
  }
  return labels;
}

function matchesContactFilters(
  suggestion: SearchSuggestion,
  filters: ContactSearchFilters,
): boolean {
  if (suggestion.type !== "contact") return true;
  const contact = (suggestion.contact ?? suggestion.data) as
    | {
        first_name?: string;
        last_name?: string;
        email?: string;
        company?: string;
        phone?: string;
      }
    | undefined;
  if (!contact) return true;
  const fullName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`
    .toLowerCase()
    .trim();
  if (filters.name && !fullName.includes(filters.name.toLowerCase())) {
    return false;
  }
  if (
    filters.email &&
    !(contact.email ?? "").toLowerCase().includes(filters.email.toLowerCase())
  ) {
    return false;
  }
  if (
    filters.company &&
    !(contact.company ?? "")
      .toLowerCase()
      .includes(filters.company.toLowerCase())
  ) {
    return false;
  }
  if (filters.hasPhone && !contact.phone) return false;
  return true;
}

function matchesCalendarFilters(
  suggestion: SearchSuggestion,
  filters: CalendarSearchFilters,
): boolean {
  if (suggestion.type !== "calendar") return true;
  const event = (suggestion.event ?? suggestion.data) as
    | { start_datetime?: string; end_datetime?: string; all_day?: boolean }
    | undefined;
  if (!event) return true;
  if (filters.allDay && !event.all_day) return false;
  if (filters.dateRange?.start && event.start_datetime) {
    const start = new Date(event.start_datetime);
    if (!Number.isNaN(start.getTime()) && start < filters.dateRange.start) {
      return false;
    }
  }
  if (filters.dateRange?.end && event.start_datetime) {
    const start = new Date(event.start_datetime);
    if (!Number.isNaN(start.getTime()) && start > filters.dateRange.end) {
      return false;
    }
  }
  return true;
}

function stripSearchOperators(query: string): string {
  return query
    .replace(/\b(?:from|to|in|folder):(?:"[^"]+"|'[^']+'|\S+)/gi, " ")
    .replace(/\bsubject:(?:"[^"]+"|'[^']+'|\S+)/gi, " ")
    .replace(/\bhas:attachment\b/gi, " ")
    .replace(/\bis:(?:read|unread|starred)\b/gi, " ")
    .replace(/\b(?:after|before):\d{4}-\d{2}-\d{2}\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeOperatorFilters(
  query: string,
  filters: AdvancedSearchFilters,
): AdvancedSearchFilters {
  const searchService = getSearchService();

  if (!searchService.hasSearchOperators(query)) {
    return filters;
  }

  const parsed = searchService.parseSearchQuery(query);
  return {
    ...filters,
    ...Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => value !== undefined),
    ),
    dateRange: parsed.dateRange ?? filters.dateRange,
  };
}

function getPlaceholders(): Record<HeaderSearchScope, string> {
  return {
    emails: __("Search mail...", "pressedmail"),
    contacts: __("Search contacts...", "pressedmail"),
    calendar: __("Search calendar...", "pressedmail"),
  };
}

function getAvailableSearchScopeOptions(
  targets: readonly string[] | undefined,
): SearchScopeOption[] {
  const availableTargets = new Set(targets ?? DEFAULT_HEADER_SEARCH_TARGETS);

  return SEARCH_SCOPE_OPTIONS.filter((option) => {
    if (option.value === "emails") return true;
    if (option.value === "contacts") {
      return __ENABLE_CONTACTS__ && availableTargets.has("contacts");
    }
    return __ENABLE_CALENDAR__ && availableTargets.has("events");
  });
}

function parseNumericEntityId(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/^(?:[A-Za-z][A-Za-z0-9]*[_-])?(\d+)$/);
  if (!match?.[1]) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function firstNumericId(values: unknown[]): number | null {
  for (const value of values) {
    const parsed = parseNumericEntityId(value);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function extractId(suggestion: SearchSuggestion): string | number | undefined {
  const fromEvent = (suggestion.event as { id?: number } | undefined)?.id;
  if (fromEvent !== undefined && fromEvent !== null) return fromEvent;
  const fromContact = (suggestion.contact as { id?: number } | undefined)?.id;
  if (fromContact !== undefined && fromContact !== null) return fromContact;
  const fromMessage = (
    suggestion.message as { id?: number | string } | undefined
  )?.id;
  if (fromMessage !== undefined && fromMessage !== null) return fromMessage;
  const fromData = (suggestion.data as { id?: number | string } | undefined)
    ?.id;
  if (fromData !== undefined && fromData !== null) return fromData;
  return suggestion.id;
}

function extractContactId(suggestion: SearchSuggestion): number | null {
  return firstNumericId([
    (suggestion.contact as { id?: unknown } | undefined)?.id,
    (suggestion.data as { id?: unknown } | undefined)?.id,
    suggestion.id,
  ]);
}

function extractCalendarId(suggestion: SearchSuggestion): number | null {
  return firstNumericId([
    (suggestion.event as { id?: unknown } | undefined)?.id,
    (suggestion.data as { id?: unknown } | undefined)?.id,
    suggestion.id,
  ]);
}

function extractEventDate(suggestion: SearchSuggestion): string | null {
  const event = (suggestion.event ?? suggestion.data) as
    | { start_datetime?: string; start_date?: string }
    | undefined;
  const raw = event?.start_datetime ?? event?.start_date;
  if (!raw) return null;

  const dateMatch = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (dateMatch?.[0]) return dateMatch[0];

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateInputValue(parsed);
}

function suggestionPath(suggestion: SearchSuggestion): string | null {
  const id = extractId(suggestion);
  if (id === undefined || id === null) return null;
  switch (suggestion.type) {
    case "email": {
      const message = (suggestion.message ?? suggestion.data) as
        | { accountId?: number; folder?: string }
        | undefined;
      const params = new URLSearchParams({ openMessageId: String(id) });
      if (message?.accountId) {
        params.set("accountId", String(message.accountId));
      }
      if (message?.folder) {
        params.set("folder", message.folder);
      }
      return `/inbox?${params.toString()}`;
    }
    case "contact": {
      const contactId = extractContactId(suggestion);
      return contactId === null ? null : `/contacts?openContactId=${contactId}`;
    }
    case "calendar": {
      const eventId = extractCalendarId(suggestion);
      if (eventId === null) return null;
      const params = new URLSearchParams({ openEventId: String(eventId) });
      const eventDate = extractEventDate(suggestion);
      if (eventDate) {
        params.set("date", eventDate);
      }
      return `/calendar?${params.toString()}`;
    }
    default:
      return null;
  }
}

export function HeaderSearchInput({
  className,
  placeholder,
}: HeaderSearchInputProps) {
  const navigate = useNavigate();
  const searchOps = useSearchOperations();
  const [scope, setScope] = React.useState<HeaderSearchScope>("emails");
  const [value, setValue] = React.useState(searchOps.searchTerm);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [draftFilters, setDraftFilters] = React.useState<DraftFilters>(() =>
    filtersToDraft(searchOps.advancedFilters),
  );
  const [contactFilters, setContactFilters] =
    React.useState<ContactSearchFilters>(DEFAULT_CONTACT_FILTERS);
  const [calendarFilters, setCalendarFilters] =
    React.useState<CalendarSearchFilters>(DEFAULT_CALENDAR_FILTERS);
  const [contactDraft, setContactDraft] =
    React.useState<DraftContactFilters>(EMPTY_CONTACT_DRAFT);
  const [calendarDraft, setCalendarDraft] =
    React.useState<DraftCalendarFilters>(EMPTY_CALENDAR_DRAFT);
  const [isFocused, setIsFocused] = React.useState(false);
  const [remoteSuggestions, setRemoteSuggestions] = React.useState<
    SearchSuggestion[]
  >([]);
  const executeSearchRef = React.useRef(searchOps.executeSearch);
  const availableScopeOptions = React.useMemo(
    () => getAvailableSearchScopeOptions(searchOps.availableSearchTargets),
    [searchOps.availableSearchTargets],
  );
  const availableScopes = React.useMemo(
    () => new Set(availableScopeOptions.map((option) => option.value)),
    [availableScopeOptions],
  );
  const effectiveScope: HeaderSearchScope = availableScopes.has(scope)
    ? scope
    : "emails";

  React.useEffect(() => {
    executeSearchRef.current = searchOps.executeSearch;
  }, [searchOps.executeSearch]);

  React.useEffect(() => {
    if (scope === effectiveScope) return;
    setScope(effectiveScope);
    setRemoteSuggestions([]);
    setFilterOpen(false);
  }, [effectiveScope, scope]);

  React.useEffect(() => {
    setValue(searchOps.searchTerm);
  }, [searchOps.searchTerm]);

  React.useEffect(() => {
    if (filterOpen) {
      setDraftFilters(filtersToDraft(searchOps.advancedFilters));
      setContactDraft({
        name: contactFilters.name ?? "",
        email: contactFilters.email ?? "",
        company: contactFilters.company ?? "",
        hasPhone: contactFilters.hasPhone === true,
      });
      setCalendarDraft({
        dateStart: toDateInputValue(calendarFilters.dateRange?.start),
        dateEnd: toDateInputValue(calendarFilters.dateRange?.end),
        allDay: calendarFilters.allDay === true,
      });
    }
  }, [filterOpen, searchOps.advancedFilters, contactFilters, calendarFilters]);

  const activeFilterLabels = React.useMemo(() => {
    if (effectiveScope === "emails")
      return getActiveFilterLabels(searchOps.advancedFilters);
    if (effectiveScope === "contacts")
      return getContactFilterLabels(contactFilters);
    return getCalendarFilterLabels(calendarFilters);
  }, [
    effectiveScope,
    searchOps.advancedFilters,
    contactFilters,
    calendarFilters,
  ]);

  const hasSearchValue = value.trim().length > 0;
  const hasFilters = activeFilterLabels.length > 0;
  const effectiveTerm = stripSearchOperators(value);
  const effectiveFilters = mergeOperatorFilters(
    value,
    searchOps.advancedFilters,
  );

  // Inbox-side filtering only runs in mail scope.
  React.useEffect(() => {
    if (effectiveScope !== "emails") return;
    const timer = window.setTimeout(() => {
      executeSearchRef.current(effectiveTerm, effectiveFilters);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [effectiveFilters, effectiveScope, effectiveTerm]);

  // Server-side typeahead, scoped.
  React.useEffect(() => {
    const term = value.trim();
    if (!isFocused || term.length < 2) {
      setRemoteSuggestions([]);
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(() => {
      void getSearchService()
        .getSuggestions(term, 8, effectiveScope)
        .then((items) => {
          if (cancelled) return;
          setRemoteSuggestions(items);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [effectiveScope, value, isFocused]);

  const suggestions = React.useMemo(() => {
    if (effectiveScope === "emails") {
      return remoteSuggestions.filter((s) => s.type === "email").slice(0, 6);
    }
    if (effectiveScope === "contacts") {
      return remoteSuggestions
        .filter((s) => s.type === "contact")
        .filter((s) => matchesContactFilters(s, contactFilters))
        .slice(0, 6);
    }
    return remoteSuggestions
      .filter((s) => s.type === "calendar")
      .filter((s) => matchesCalendarFilters(s, calendarFilters))
      .slice(0, 6);
  }, [effectiveScope, remoteSuggestions, contactFilters, calendarFilters]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setValue(nextValue);
    if (effectiveScope === "emails") {
      searchOps.setSearchTerm(nextValue);
    }
  };

  const handleClearSearch = () => {
    setValue("");
    setRemoteSuggestions([]);
    if (effectiveScope === "emails") {
      searchOps.clearSearch();
    } else if (effectiveScope === "contacts") {
      setContactFilters(DEFAULT_CONTACT_FILTERS);
    } else {
      setCalendarFilters(DEFAULT_CALENDAR_FILTERS);
    }
  };

  const handleScopeChange = (next: HeaderSearchScope) => {
    if (!availableScopes.has(next)) return;
    setScope(next);
    setRemoteSuggestions([]);
    setFilterOpen(false);
  };

  const applyDraftFilters = () => {
    if (effectiveScope === "emails") {
      const nextFilters = draftToFilters(draftFilters);
      searchOps.setAdvancedFilters(nextFilters);
      searchOps.executeSearch(
        stripSearchOperators(value),
        mergeOperatorFilters(value, nextFilters),
      );
    } else if (effectiveScope === "contacts") {
      setContactFilters(contactDraftToFilters(contactDraft));
    } else {
      setCalendarFilters(calendarDraftToFilters(calendarDraft));
    }
    setFilterOpen(false);
  };

  const clearDraftFilters = () => {
    if (effectiveScope === "emails") {
      setDraftFilters(EMPTY_DRAFT_FILTERS);
      searchOps.clearAdvancedFilters();
      searchOps.executeSearch(
        stripSearchOperators(value),
        DEFAULT_SEARCH_FILTERS,
      );
    } else if (effectiveScope === "contacts") {
      setContactDraft(EMPTY_CONTACT_DRAFT);
      setContactFilters(DEFAULT_CONTACT_FILTERS);
    } else {
      setCalendarDraft(EMPTY_CALENDAR_DRAFT);
      setCalendarFilters(DEFAULT_CALENDAR_FILTERS);
    }
    setFilterOpen(false);
  };

  const updateDraft = <K extends keyof DraftFilters>(
    key: K,
    nextValue: DraftFilters[K],
  ) => {
    setDraftFilters((current) => ({ ...current, [key]: nextValue }));
  };

  const updateContactDraft = <K extends keyof DraftContactFilters>(
    key: K,
    nextValue: DraftContactFilters[K],
  ) => {
    setContactDraft((current) => ({ ...current, [key]: nextValue }));
  };

  const updateCalendarDraft = <K extends keyof DraftCalendarFilters>(
    key: K,
    nextValue: DraftCalendarFilters[K],
  ) => {
    setCalendarDraft((current) => ({ ...current, [key]: nextValue }));
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    const path = suggestionPath(suggestion);
    if (!path) return;
    setRemoteSuggestions([]);
    setIsFocused(false);
    navigate(path);
  };

  const handleShowAllResults = () => {
    if (effectiveScope === "emails") {
      searchOps.executeSearch(effectiveTerm, effectiveFilters);
      navigate("/inbox");
    } else if (effectiveScope === "contacts") {
      navigate(
        `/contacts?${new URLSearchParams({ contactSearch: effectiveTerm })}`,
      );
    } else {
      navigate(
        `/calendar?${new URLSearchParams({
          view: "list",
          eventSearch: effectiveTerm,
        })}`,
      );
    }
    setRemoteSuggestions([]);
    setIsFocused(false);
  };

  const resolvedPlaceholder = placeholder ?? getPlaceholders()[effectiveScope];
  const showAllResultsLabel = `Show all results for "${effectiveTerm}"`;

  return (
    <div className={cn("relative w-full", className)}>
      <div
        className={cn(
          "flex h-9 items-center gap-0 overflow-hidden rounded-md border border-input bg-card px-0 text-sm shadow-sm transition-colors",
          "focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-primary/15",
        )}>
        <SearchScopeDropdown
          value={effectiveScope}
          options={availableScopeOptions}
          onChange={handleScopeChange}
          className="h-full w-11 rounded-none border-r border-input py-0"
        />
        <Input
          autoComplete="off"
          type="search"
          role="searchbox"
          data-test="header-search-input"
          aria-label={resolvedPlaceholder}
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
          placeholder={resolvedPlaceholder}
          data-no-theme
          className="h-full max-h-full min-h-0 flex-1 rounded-none border-0 bg-transparent px-3 py-0 leading-5 shadow-none outline-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {activeFilterLabels.slice(0, 1).map((label) => (
          <Badge
            key={label}
            variant="secondary"
            className="hidden max-w-32 truncate px-1.5 py-0 text-[10px] md:inline-flex">
            {label}
          </Badge>
        ))}
        {activeFilterLabels.length > 1 && (
          <Badge
            variant="secondary"
            className="hidden px-1.5 py-0 text-[10px] md:inline-flex">
            +{activeFilterLabels.length - 1}
          </Badge>
        )}
        {(hasSearchValue || hasFilters) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-full w-9 shrink-0 rounded-none py-0"
            onClick={handleClearSearch}
            aria-label={__("Clear search", "pressedmail")}>
            <X className="h-4 w-4" />
          </Button>
        )}
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant={hasFilters ? "secondary" : "ghost"}
              size="icon"
              className={cn(
                "h-full w-10 shrink-0 rounded-none border-l border-input py-0",
                __IS_PRO__ &&
                  "bg-clip-border hover:bg-accent data-[state=open]:bg-accent",
              )}
              aria-label={__("Filter search", "pressedmail")}>
              <Filter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="w-[23rem] p-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  {__("Search filters", "pressedmail")}
                </h3>
              </div>
              {effectiveScope === "emails" ? (
                <MailFiltersForm draft={draftFilters} update={updateDraft} />
              ) : effectiveScope === "contacts" ? (
                <ContactFiltersForm
                  draft={contactDraft}
                  update={updateContactDraft}
                />
              ) : (
                <CalendarFiltersForm
                  draft={calendarDraft}
                  update={updateCalendarDraft}
                />
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={clearDraftFilters}>
                  {__("Clear filters", "pressedmail")}
                </Button>
                <Button type="button" onClick={applyDraftFilters}>
                  {__("Apply filters", "pressedmail")}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {suggestions.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-md border bg-popover shadow-md"
          data-test="header-search-suggestions"
          data-testid="header-search-suggestions">
          {effectiveTerm.length >= 2 ? (
            <button
              type="button"
              aria-label={showAllResultsLabel}
              data-test="header-search-show-all"
              data-testid="header-search-show-all"
              className="flex w-full items-center justify-between gap-3 border-b border-border/60 bg-primary/5 px-3 py-2 text-left text-sm text-primary hover:bg-primary/10"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleShowAllResults}>
              <span className="min-w-0 truncate font-medium">
                {showAllResultsLabel}
              </span>
            </button>
          ) : null}
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              data-test={`header-search-suggestion-${suggestion.type}`}
              data-testid={`header-search-suggestion-${suggestion.type}`}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSuggestionClick(suggestion)}>
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {suggestion.title}
                </span>
                {suggestion.subtitle ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {suggestion.subtitle}
                  </span>
                ) : null}
              </span>
              {suggestion.date ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {suggestion.date}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface MailFiltersFormProps {
  draft: DraftFilters;
  update: <K extends keyof DraftFilters>(
    key: K,
    value: DraftFilters[K],
  ) => void;
}

function MailFiltersForm({ draft, update }: MailFiltersFormProps) {
  return (
    <>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="header-search-from">
            {__("Sender", "pressedmail")}
          </Label>
          <Input
            autoComplete="off"
            id="header-search-from"
            value={draft.from}
            onChange={(event) => update("from", event.target.value)}
            placeholder={__("name or email", "pressedmail")}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="header-search-to">
            {__("Recipient", "pressedmail")}
          </Label>
          <Input
            autoComplete="off"
            id="header-search-to"
            value={draft.to}
            onChange={(event) => update("to", event.target.value)}
            placeholder={__("name or email", "pressedmail")}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="header-search-subject">
            {__("Subject", "pressedmail")}
          </Label>
          <Input
            autoComplete="off"
            id="header-search-subject"
            value={draft.subject}
            onChange={(event) => update("subject", event.target.value)}
            placeholder={__("subject contains", "pressedmail")}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="header-search-folder">
            {__("Folder", "pressedmail")}
          </Label>
          <Input
            autoComplete="off"
            id="header-search-folder"
            value={draft.folder}
            onChange={(event) => update("folder", event.target.value)}
            placeholder={__("Inbox, Sent, Archive", "pressedmail")}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="header-search-date-start">
              {__("Date from", "pressedmail")}
            </Label>
            <DateTimeSelector
              id="header-search-date-start"
              mode="date"
              value={draft.dateStart}
              onChange={(value) => update("dateStart", value)}
              data-test="header-search-date-start-picker"
              data-testid="header-search-date-start-picker"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="header-search-date-end">
              {__("Date to", "pressedmail")}
            </Label>
            <DateTimeSelector
              id="header-search-date-end"
              mode="date"
              value={draft.dateEnd}
              onChange={(value) => update("dateEnd", value)}
              data-test="header-search-date-end-picker"
              data-testid="header-search-date-end-picker"
            />
          </div>
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox
            checked={draft.readStatus === "unread"}
            onCheckedChange={(checked) =>
              update("readStatus", checked ? "unread" : "all")
            }
          />
          {__("Unread", "pressedmail")}
        </label>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={draft.readStatus === "read"}
            onCheckedChange={(checked) =>
              update("readStatus", checked ? "read" : "all")
            }
          />
          {__("Read", "pressedmail")}
        </label>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={draft.starred}
            onCheckedChange={(checked) => update("starred", checked === true)}
          />
          {__("Starred", "pressedmail")}
        </label>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={draft.hasAttachments}
            onCheckedChange={(checked) =>
              update("hasAttachments", checked === true)
            }
          />
          {__("Attachments", "pressedmail")}
        </label>
      </div>
    </>
  );
}

interface ContactFiltersFormProps {
  draft: DraftContactFilters;
  update: <K extends keyof DraftContactFilters>(
    key: K,
    value: DraftContactFilters[K],
  ) => void;
}

function ContactFiltersForm({ draft, update }: ContactFiltersFormProps) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="header-search-contact-name">
          {__("Name", "pressedmail")}
        </Label>
        <Input
          autoComplete="off"
          id="header-search-contact-name"
          value={draft.name}
          onChange={(event) => update("name", event.target.value)}
          placeholder={__("first or last name", "pressedmail")}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="header-search-contact-email">
          {__("Email", "pressedmail")}
        </Label>
        <Input
          autoComplete="off"
          id="header-search-contact-email"
          value={draft.email}
          onChange={(event) => update("email", event.target.value)}
          placeholder={__("email contains", "pressedmail")}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="header-search-contact-company">
          {__("Company", "pressedmail")}
        </Label>
        <Input
          autoComplete="off"
          id="header-search-contact-company"
          value={draft.company}
          onChange={(event) => update("company", event.target.value)}
          placeholder={__("company name", "pressedmail")}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={draft.hasPhone}
          onCheckedChange={(checked) => update("hasPhone", checked === true)}
        />
        {__("Has phone number", "pressedmail")}
      </label>
    </div>
  );
}

interface CalendarFiltersFormProps {
  draft: DraftCalendarFilters;
  update: <K extends keyof DraftCalendarFilters>(
    key: K,
    value: DraftCalendarFilters[K],
  ) => void;
}

function CalendarFiltersForm({ draft, update }: CalendarFiltersFormProps) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="header-search-event-date-start">
            {__("Date from", "pressedmail")}
          </Label>
          <DateTimeSelector
            id="header-search-event-date-start"
            mode="date"
            value={draft.dateStart}
            onChange={(value) => update("dateStart", value)}
            data-test="header-search-event-date-start-picker"
            data-testid="header-search-event-date-start-picker"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="header-search-event-date-end">
            {__("Date to", "pressedmail")}
          </Label>
          <DateTimeSelector
            id="header-search-event-date-end"
            mode="date"
            value={draft.dateEnd}
            onChange={(value) => update("dateEnd", value)}
            data-test="header-search-event-date-end-picker"
            data-testid="header-search-event-date-end-picker"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={draft.allDay}
          onCheckedChange={(checked) => update("allDay", checked === true)}
        />
        {__("All-day events only", "pressedmail")}
      </label>
    </div>
  );
}

export default HeaderSearchInput;
