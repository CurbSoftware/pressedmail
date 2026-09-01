"use client";

/**
 * Search Command Menu Component
 *
 * Full command menu overlay (dialog-based) for searching emails and contacts.
 * Opens when the SearchTrigger is clicked or "/" is pressed.
 * Shows live results grouped by type as the user types.
 *
 * @since 3.2.0
 */

import * as React from "react";
import { __ } from "@wordpress/i18n";
import {
  Search,
  Mail,
  User,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  Paperclip,
  Star,
} from "lucide-react";
import {
  CommandDialog,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  Badge,
  Button,
  Input,
  Label,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@kit/ui/plugin";
import { cn } from "@/lib/utils";
import { useSearchCommandMenu } from "./SearchCommandMenuContext";
import { useMessageOperations } from "@/context/InboxContext";
import {
  parseSearchQuery,
  getOperatorSuggestions,
  getOperatorValueSuggestions,
} from "@/services/search-operators.service";
import { getActiveFilterLabels } from "@/types/search";
import type { SearchSuggestion } from "@/types/search";

export interface SearchCommandMenuProps {
  className?: string;
}

export function SearchCommandMenu({ className }: SearchCommandMenuProps) {
  const { isOpen, setOpen } = useSearchCommandMenu();

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={setOpen}
      title={__("Search", "pressedmail")}
      description={__("Search emails and contacts", "pressedmail")}>
      {isOpen && <SearchCommandMenuContent className={className} />}
    </CommandDialog>
  );
}

/**
 * Inner content, only mounts when the dialog is open.
 * Safe to call InboxContext hooks here since InboxProvider
 * is guaranteed to be an ancestor at render time.
 */
function SearchCommandMenuContent({ className }: { className?: string }) {
  const { close, search, sharedOps, contactsAvailable } =
    useSearchCommandMenu();

  // Safe to call here, only renders when dialog is open and InboxProvider is an ancestor
  const { selectMessage } = useMessageOperations();

  const [showFilters, setShowFilters] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Group suggestions by type
  const emailSuggestions = React.useMemo(
    () => search.suggestions.filter((s) => s.type === "email"),
    [search.suggestions],
  );
  const contactSuggestions = React.useMemo(
    () =>
      contactsAvailable
        ? search.suggestions.filter((s) => s.type === "contact")
        : [],
    [search.suggestions, contactsAvailable],
  );

  // Operator suggestions based on current input
  const operatorSuggestions = React.useMemo(() => {
    const term = search.searchTerm.trim();
    if (!term) return [];

    const words = term.split(/\s+/);
    const lastWord = words[words.length - 1] || "";

    // Check if typing an operator value (e.g., "from:" or "is:u")
    const colonIndex = lastWord.indexOf(":");
    if (colonIndex !== -1) {
      const operator = lastWord.slice(0, colonIndex);
      const valueTyped = lastWord.slice(colonIndex + 1);
      const valueSuggestions = getOperatorValueSuggestions(operator);
      if (valueSuggestions.length > 0) {
        return valueSuggestions
          .filter((v) => v.toLowerCase().startsWith(valueTyped.toLowerCase()))
          .slice(0, 5)
          .map((v) => ({
            type: "operator-value" as const,
            operator,
            value: v,
            display: `${operator}:${v}`,
            description: undefined as string | undefined,
            examples: undefined as string[] | undefined,
          }));
      }
      return [];
    }

    // Check if typing an operator name
    const opSuggestions = getOperatorSuggestions(lastWord);
    return opSuggestions.slice(0, 5).map((op) => ({
      type: "operator-name" as const,
      operator: op.name,
      value: "",
      display: `${op.name}:`,
      description: op.description,
      examples: op.examples,
    }));
  }, [search.searchTerm]);

  // Parse query and sync filters
  const parsedQuery = React.useMemo(
    () => parseSearchQuery(search.searchTerm),
    [search.searchTerm],
  );

  React.useEffect(() => {
    const parsed = parsedQuery.filters;
    const hasNewFilters =
      parsed.from ||
      parsed.to ||
      parsed.subject ||
      parsed.hasAttachments ||
      parsed.starred ||
      parsed.readStatus ||
      parsed.folder ||
      parsed.dateRange?.start ||
      parsed.dateRange?.end;

    if (hasNewFilters) {
      sharedOps.setAdvancedFilters({
        ...sharedOps.advancedFilters,
        from: parsed.from || sharedOps.advancedFilters.from,
        to: parsed.to || sharedOps.advancedFilters.to,
        subject: parsed.subject || sharedOps.advancedFilters.subject,
        hasAttachments:
          parsed.hasAttachments ?? sharedOps.advancedFilters.hasAttachments,
        starred: parsed.starred ?? sharedOps.advancedFilters.starred,
        readStatus: parsed.readStatus || sharedOps.advancedFilters.readStatus,
        folder: parsed.folder || sharedOps.advancedFilters.folder,
        dateRange: parsed.dateRange || sharedOps.advancedFilters.dateRange,
      });
    }
  }, [parsedQuery.filters, sharedOps]);

  // Recent searches, refreshed each time the inner component mounts (dialog opens)

  const recentSearches = React.useMemo(
    () => sharedOps.getRecentSearches(),
    [sharedOps],
  );

  // Handle search input change
  const handleSearchChange = React.useCallback(
    (value: string) => {
      search.setSearchTerm(value);
      if (value.trim().length >= 2) {
        search.setShowSuggestions(true);
      }
    },
    [search],
  );

  // Handle search submit
  const performSearch = React.useCallback(() => {
    sharedOps.executeSearch(search.searchTerm, sharedOps.advancedFilters);
    close();
  }, [search.searchTerm, sharedOps, close]);

  // Handle suggestion select
  const handleSuggestionSelect = React.useCallback(
    (suggestion: SearchSuggestion) => {
      if (suggestion.type === "email" && suggestion.message) {
        selectMessage(suggestion.message);
      } else if (suggestion.type === "contact" && suggestion.data) {
        search.setSearchTerm(suggestion.title);
      }
      close();
    },
    [selectMessage, search, close],
  );

  // Handle operator suggestion select
  const handleOperatorSelect = React.useCallback(
    (opSuggestion: (typeof operatorSuggestions)[0]) => {
      const term = search.searchTerm;
      const words = term.split(/\s+/);
      const beforeLast = words.slice(0, -1).join(" ");

      let newTerm: string;
      if (opSuggestion.type === "operator-name") {
        newTerm = beforeLast
          ? `${beforeLast} ${opSuggestion.display}`
          : opSuggestion.display;
      } else {
        newTerm = beforeLast
          ? `${beforeLast} ${opSuggestion.display} `
          : `${opSuggestion.display} `;
      }

      search.setSearchTerm(newTerm);
      // Focus back to input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    },
    [search],
  );

  // Handle recent search select
  const handleRecentSelect = React.useCallback(
    (term: string) => {
      search.setSearchTerm(term);
      search.setShowSuggestions(true);
    },
    [search],
  );

  // Active filter info
  const activeFilterLabels = getActiveFilterLabels(sharedOps.advancedFilters);

  // Has any content to show
  const hasSearchTerm = search.searchTerm.trim().length > 0;
  const hasSuggestions =
    emailSuggestions.length > 0 || contactSuggestions.length > 0;
  const hasOperatorSuggestions = operatorSuggestions.length > 0;

  return (
    <>
      {/* Search input */}
      <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
        <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
        <input autoComplete="off"
          ref={inputRef}
          className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 shadow-none! border-transparent! focus:shadow-none! focus:border-transparent!"
          placeholder={
            contactsAvailable
              ? __("Search emails & contacts...", "pressedmail")
              : __("Search emails...", "pressedmail")
          }
          value={search.searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !hasSuggestions) {
              e.preventDefault();
              performSearch();
            }
          }}
          autoFocus
        />
        {search.isLoadingSuggestions && (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
        )}
        {search.searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              search.clearSearch();
              search.resetFilters();
              sharedOps.clearSearch();
              inputRef.current?.focus();
            }}
            className="h-6 w-6 p-0 shrink-0">
            <X className="h-4 w-4" />
          </Button>
        )}
        {/* Active filter badges */}
        {activeFilterLabels.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            {activeFilterLabels.slice(0, 2).map((label) => (
              <Badge
                key={label}
                variant="secondary"
                className="px-2 py-0.5 text-xs">
                {label}
              </Badge>
            ))}
            {activeFilterLabels.length > 2 && (
              <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                +{activeFilterLabels.length - 2}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Results list */}
      <CommandList className="max-h-[400px]">
        {/* Placeholder when no search term and no recent searches */}
        {!hasSearchTerm && recentSearches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="h-8 w-8 mb-3 opacity-40" />
            <p className="text-sm">
              {__("Search results will display here", "pressedmail")}
            </p>
          </div>
        )}

        {/* Recent searches when no search term */}
        {!hasSearchTerm && recentSearches.length > 0 && (
          <CommandGroup heading={__("Recent Searches", "pressedmail")}>
            {recentSearches.slice(0, 5).map((term) => (
              <CommandItem
                key={term}
                value={`recent-${term}`}
                onSelect={() => handleRecentSelect(term)}
                className="flex items-center gap-3 cursor-pointer">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm">{term}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Operator suggestions */}
        {hasSearchTerm && hasOperatorSuggestions && !hasSuggestions && (
          <CommandGroup heading={__("Search Operators", "pressedmail")}>
            {operatorSuggestions.map((opSugg) => (
              <CommandItem
                key={`${opSugg.operator}-${opSugg.value || "op"}`}
                value={`op-${opSugg.display}`}
                onSelect={() => handleOperatorSelect(opSugg)}
                className="flex items-center gap-3 cursor-pointer">
                <code className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">
                  {opSugg.display}
                </code>
                <div className="flex-1 min-w-0">
                  {opSugg.type === "operator-name" && opSugg.description && (
                    <div className="truncate text-xs text-muted-foreground">
                      {opSugg.description}
                    </div>
                  )}
                  {opSugg.type === "operator-name" && opSugg.examples && (
                    <div className="flex gap-1 mt-0.5">
                      {opSugg.examples.slice(0, 2).map((ex) => (
                        <Badge
                          key={ex}
                          variant="outline"
                          className="text-[10px] font-normal px-1 py-0">
                          {ex}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Contact suggestions */}
        {contactSuggestions.length > 0 && (
          <>
            <CommandGroup heading={__("Contacts", "pressedmail")}>
              {contactSuggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion.id}
                  value={`contact-${suggestion.id}`}
                  onSelect={() => handleSuggestionSelect(suggestion)}
                  className="flex items-center gap-3 cursor-pointer">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium text-sm">
                      {suggestion.title}
                    </div>
                    {suggestion.subtitle && (
                      <div className="truncate text-xs text-muted-foreground">
                        {suggestion.subtitle}
                      </div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {emailSuggestions.length > 0 && <CommandSeparator />}
          </>
        )}

        {/* Email suggestions */}
        {emailSuggestions.length > 0 && (
          <CommandGroup heading={__("Emails", "pressedmail")}>
            {emailSuggestions.map((suggestion) => (
              <CommandItem
                key={suggestion.id}
                value={`email-${suggestion.id}`}
                onSelect={() => handleSuggestionSelect(suggestion)}
                className="flex items-center gap-3 cursor-pointer">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-sm">
                    {suggestion.title}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {suggestion.subtitle}
                  </div>
                </div>
                {suggestion.date && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {suggestion.date}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Empty state when searching */}
        {hasSearchTerm &&
          !hasSuggestions &&
          !hasOperatorSuggestions &&
          !search.isLoadingSuggestions && (
            <CommandEmpty>
              {__("No results found.", "pressedmail")}
            </CommandEmpty>
          )}
      </CommandList>

      {/* Collapsible advanced filters */}
      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <div className="flex items-center justify-between px-3 py-2 border-t">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 gap-1.5 px-2 text-xs",
                activeFilterLabels.length > 0 && "text-primary",
              )}>
              <Filter className="h-3.5 w-3.5" />
              {__("Filters", "pressedmail")}
              {activeFilterLabels.length > 0 && (
                <Badge
                  variant="secondary"
                  className="px-1.5 py-0 text-[10px] ml-1">
                  {activeFilterLabels.length}
                </Badge>
              )}
              {showFilters ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </CollapsibleTrigger>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {__("Enter", "pressedmail")}{" "}
              <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[10px]">
                ↵
              </kbd>{" "}
              {__("to search", "pressedmail")}
            </span>
            <span>
              <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[10px]">
                Esc
              </kbd>{" "}
              {__("to close", "pressedmail")}
            </span>
          </div>
        </div>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 border-t space-y-3">
            {/* Filter fields in compact 2-column grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* From */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {__("From", "pressedmail")}
                </Label>
                <Input autoComplete="off"
                  type="text"
                  placeholder={__("Sender", "pressedmail")}
                  value={sharedOps.advancedFilters.from || ""}
                  onChange={(e) =>
                    sharedOps.setAdvancedFilters({
                      ...sharedOps.advancedFilters,
                      from: e.target.value,
                    })
                  }
                  className="h-7 text-xs"
                />
              </div>

              {/* To */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {__("To", "pressedmail")}
                </Label>
                <Input autoComplete="off"
                  type="text"
                  placeholder={__("Recipient", "pressedmail")}
                  value={sharedOps.advancedFilters.to || ""}
                  onChange={(e) =>
                    sharedOps.setAdvancedFilters({
                      ...sharedOps.advancedFilters,
                      to: e.target.value,
                    })
                  }
                  className="h-7 text-xs"
                />
              </div>

              {/* Subject */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {__("Subject", "pressedmail")}
                </Label>
                <Input autoComplete="off"
                  type="text"
                  placeholder={__("Keywords", "pressedmail")}
                  value={sharedOps.advancedFilters.subject || ""}
                  onChange={(e) =>
                    sharedOps.setAdvancedFilters({
                      ...sharedOps.advancedFilters,
                      subject: e.target.value,
                    })
                  }
                  className="h-7 text-xs"
                />
              </div>

              {/* Status */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {__("Status", "pressedmail")}
                </Label>
                <Select
                  value={sharedOps.advancedFilters.readStatus || "all"}
                  onValueChange={(value) =>
                    sharedOps.setAdvancedFilters({
                      ...sharedOps.advancedFilters,
                      readStatus: value as "all" | "read" | "unread",
                    })
                  }>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {__("All", "pressedmail")}
                    </SelectItem>
                    <SelectItem value="unread">
                      {__("Unread", "pressedmail")}
                    </SelectItem>
                    <SelectItem value="read">
                      {__("Read", "pressedmail")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Checkbox filters */}
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cmd-filter-attachments"
                  checked={sharedOps.advancedFilters.hasAttachments || false}
                  onCheckedChange={(checked) =>
                    sharedOps.setAdvancedFilters({
                      ...sharedOps.advancedFilters,
                      hasAttachments: checked === true,
                    })
                  }
                />
                <Label
                  htmlFor="cmd-filter-attachments"
                  className="text-xs font-normal cursor-pointer flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  {__("Attachments", "pressedmail")}
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cmd-filter-starred"
                  checked={sharedOps.advancedFilters.starred || false}
                  onCheckedChange={(checked) =>
                    sharedOps.setAdvancedFilters({
                      ...sharedOps.advancedFilters,
                      starred: checked === true,
                    })
                  }
                />
                <Label
                  htmlFor="cmd-filter-starred"
                  className="text-xs font-normal cursor-pointer flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  {__("Starred", "pressedmail")}
                </Label>
              </div>

              {/* Reset button */}
              {activeFilterLabels.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs ml-auto"
                  onClick={() => {
                    sharedOps.clearAdvancedFilters();
                    search.resetFilters();
                  }}>
                  <X className="h-3 w-3 mr-1" />
                  {__("Reset", "pressedmail")}
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}

export default SearchCommandMenu;
