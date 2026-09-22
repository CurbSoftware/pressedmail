/**
 * RecipientInput: the tokenized To/Cc/Bcc field, one file for both editions.
 *
 * Typed and pasted addresses become chips here. Everything contacts-backed
 * (suggestions, the contact picker) comes from `RecipientContacts.active`,
 * which the edition alias table resolves to the Pro module or to a Free twin
 * that offers nothing, so this file is safe in the WordPress.org build.
 *
 * @since 1.3.0
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
} from "react";
import { __, sprintf, _n } from "@wordpress/i18n";
import { User, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ButtonGroup } from "@kit/ui/plugin";
import {
  RecipientContactsButton,
  useRecipientSuggestions,
} from "@/components/compose/RecipientContacts.active";
import { COMPOSER_ROW_CLASS } from "./composer-row";
import { RecipientToken } from "./RecipientToken";
import type {
  Recipient,
  RecipientSuggestion,
  RecipientInputProps,
} from "@/types/recipients";
import {
  createRecipientFromContact,
  createRecipientFromList,
  dedupeRecipientsByEmail,
  getRecipientEmailKey,
  parseEmailString,
  getRecipientInitials,
  getRecipientAvatarColor,
} from "@/types/recipients";

/** One type style for every composer field label, so From, To, Cc and Bcc read as the same kind of thing. */
export const RECIPIENT_LABEL_CLASS =
  "shrink-0 text-xs font-medium text-muted-foreground";

/** How long a click on a suggestion has before blur hides the list. */
const BLUR_DELAY = 200;

export const RecipientInput: React.FC<RecipientInputProps> = ({
  label,
  value,
  dedupeRecipients = [],
  onChange,
  placeholder = __("Enter an email address", "pressedmail"),
  showListSuggestions = false,
  disabled = false,
  className,
  autoFocus = false,
  trailingActions,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  // Set when the typed text cannot be read as an address, so the field says so
  // instead of swallowing it.
  const [showInvalidEntry, setShowInvalidEntry] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Blur timer, held so it cannot fire against an unmounted component
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const duplicateScope = useMemo(
    () => dedupeRecipientsByEmail([...value, ...dedupeRecipients]),
    [value, dedupeRecipients],
  );

  const { suggestions, isSearching } = useRecipientSuggestions(inputValue, {
    existing: duplicateScope,
    showListSuggestions,
  });

  // Unique IDs for accessibility
  const suggestionsId = useId();
  const invalidEntryId = useId();
  const optionId = (index: number) => `${suggestionsId}-option-${index}`;

  // Focus input when clicking container
  const handleContainerClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
      setShowSuggestions(true);
      setSelectedIndex(-1);
      setShowInvalidEntry(false);
    },
    [],
  );

  // Add one or more recipients in a single onChange. Used by both single-add
  // (Enter on an email / contact pick) and list expansion (one list -> N member
  // chips). Filters out chips already present so duplicate clicks are safe.
  const addRecipients = useCallback(
    (incoming: Recipient[]) => {
      const seenIds = new Set(duplicateScope.map((r) => r.id));
      const seenEmails = new Set(
        duplicateScope
          .map(getRecipientEmailKey)
          .filter((email): email is string => Boolean(email)),
      );

      const additions: Recipient[] = [];
      for (const candidate of incoming) {
        const lowerEmail = getRecipientEmailKey(candidate);
        if (seenIds.has(candidate.id)) {
          continue;
        }
        if (lowerEmail && seenEmails.has(lowerEmail)) {
          continue;
        }
        additions.push(candidate);
        seenIds.add(candidate.id);
        if (lowerEmail) {
          seenEmails.add(lowerEmail);
        }
      }

      if (additions.length > 0) {
        onChange([...value, ...additions]);
      }

      setInputValue("");
      setShowSuggestions(false);
      setSelectedIndex(-1);
      inputRef.current?.focus();
    },
    [value, duplicateScope, onChange],
  );

  // Commit whatever the typed (or pasted) text contains. `parseEmailString`
  // splits "a@x.com, b@y.com" into two chips instead of failing a whole-string
  // email check and vanishing.
  const commitTypedRecipients = useCallback(
    (text: string): boolean => {
      const parsed = parseEmailString(text);
      if (parsed.length === 0) {
        return false;
      }
      addRecipients(parsed);
      setShowInvalidEntry(false);
      return true;
    },
    [addRecipients],
  );

  const removeRecipient = useCallback(
    (id: string) => {
      onChange(value.filter((r) => r.id !== id));
    },
    [value, onChange],
  );

  const handleSelectSuggestion = useCallback(
    (suggestion: RecipientSuggestion) => {
      if (suggestion.type === "contact" && suggestion.contact) {
        addRecipients([createRecipientFromContact(suggestion.contact)]);
        return;
      }
      if (suggestion.type === "list" && suggestion.list) {
        addRecipients([createRecipientFromList(suggestion.list)]);
      }
    },
    [addRecipients],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const trimmedValue = inputValue.trim();

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (suggestions.length > 0) {
            setSelectedIndex((prev) =>
              prev < suggestions.length - 1 ? prev + 1 : prev,
            );
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          if (suggestions.length > 0) {
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          }
          break;

        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            handleSelectSuggestion(suggestions[selectedIndex]);
          } else if (trimmedValue && !commitTypedRecipients(trimmedValue)) {
            setShowInvalidEntry(true);
          }
          break;

        case "Tab":
          if (trimmedValue && commitTypedRecipients(trimmedValue)) {
            e.preventDefault();
          } else if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            e.preventDefault();
            handleSelectSuggestion(suggestions[selectedIndex]);
          }
          break;

        case ",":
        case ";":
          if (trimmedValue && commitTypedRecipients(trimmedValue)) {
            e.preventDefault();
          }
          break;

        case "Backspace":
          if (!trimmedValue && value.length > 0) {
            // Remove last recipient when input is empty
            const lastRecipient = value[value.length - 1];
            if (lastRecipient) {
              removeRecipient(lastRecipient.id);
            }
          }
          break;

        case "Escape":
          setShowSuggestions(false);
          setSelectedIndex(-1);
          break;
      }
    },
    [
      inputValue,
      suggestions,
      selectedIndex,
      value,
      commitTypedRecipients,
      removeRecipient,
      handleSelectSuggestion,
    ],
  );

  // Paste of one or many addresses commits straight to chips. Only when the
  // field is empty, so a paste into half-typed text is left alone.
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (inputValue.trim()) {
        return;
      }
      const pasted = e.clipboardData.getData("text");
      if (pasted && commitTypedRecipients(pasted)) {
        e.preventDefault();
      }
    },
    [inputValue, commitTypedRecipients],
  );

  // A blur delay that never gets to run (unmount, or a second blur replacing
  // it) must not touch a component that is gone.
  useEffect(() => {
    return () => {
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
    };
  }, []);

  // Blur commits whatever parses, and says so when nothing does
  const handleBlur = useCallback(() => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !commitTypedRecipients(trimmedValue)) {
      setShowInvalidEntry(true);
    }
    // Delay hiding suggestions to allow click events
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
    }
    blurTimerRef.current = setTimeout(() => {
      setShowSuggestions(false);
    }, BLUR_DELAY);
  }, [inputValue, commitTypedRecipients]);

  const handleFocus = useCallback(() => {
    if (inputValue.trim()) {
      setShowSuggestions(true);
    }
  }, [inputValue]);

  // Scroll selected suggestion into view
  useEffect(() => {
    if (selectedIndex < 0) return;
    document
      .getElementById(`${suggestionsId}-option-${selectedIndex}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex, suggestionsId]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasSuggestions = suggestions.length > 0;
  const showDropdown = showSuggestions && (hasSuggestions || isSearching);
  const listboxOpen = showDropdown && hasSuggestions && !isSearching;
  const contactSuggestions = suggestions.filter((s) => s.type === "contact");
  const listSuggestions = suggestions.filter((s) => s.type === "list");

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      data-test="recipient-input"
      data-testid="recipient-input">
      {/* The row: label | chips and input | actions. */}
      <div
        onClick={handleContainerClick}
        data-test={`recipient-container-${label.toLowerCase()}`}
        data-testid={`recipient-container-${label.toLowerCase()}`}
        className={cn(
          COMPOSER_ROW_CLASS,
          disabled && "cursor-not-allowed opacity-60",
        )}>
        {/* The field's name, for sighted users. aria-hidden because the input
            already names itself. */}
        <span className={RECIPIENT_LABEL_CLASS} aria-hidden="true">
          {label}
        </span>

        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {value.map((recipient) => (
            <RecipientToken
              key={recipient.id}
              recipient={recipient}
              onRemove={() => removeRecipient(recipient.id)}
              disabled={disabled}
            />
          ))}

          <input
            ref={inputRef}
            role="combobox"
            type="text"
            data-test={`recipient-input-${label.toLowerCase()}`}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={handleBlur}
            onFocus={handleFocus}
            placeholder={value.length === 0 ? placeholder : ""}
            disabled={disabled}
            autoFocus={autoFocus}
            autoComplete="off"
            className={cn(
              "min-w-30 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground",
              disabled && "cursor-not-allowed",
            )}
            aria-label={label}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-expanded={listboxOpen}
            aria-controls={suggestionsId}
            aria-activedescendant={
              listboxOpen && selectedIndex >= 0
                ? optionId(selectedIndex)
                : undefined
            }
            aria-invalid={showInvalidEntry || undefined}
            aria-describedby={showInvalidEntry ? invalidEntryId : undefined}
          />
        </div>

        {!disabled && (
          <ButtonGroup>
            <RecipientContactsButton
              label={label}
              existingRecipients={duplicateScope}
              showLists={showListSuggestions}
              onSelect={addRecipients}
            />
            {trailingActions}
          </ButtonGroup>
        )}
      </div>

      {showInvalidEntry ? (
        <p
          id={invalidEntryId}
          role="alert"
          data-test={`recipient-error-${label.toLowerCase()}`}
          className="mt-1 text-xs text-destructive">
          {__(
            "That does not look like an email address, so nothing was added.",
            "pressedmail",
          )}
        </p>
      ) : null}

      {/* Suggestions dropdown. The listbox stays mounted (hidden) so the
          input's aria-controls always resolves; options are not tab stops,
          the input owns focus and points at the highlighted one through
          aria-activedescendant. */}
      {/* Always mounted and outside the hidden dropdown: a live region that
          appears with its text already inside is often not announced. */}
      <span role="status" className="sr-only">
        {isSearching ? __("Searching…", "pressedmail") : ""}
      </span>
      <div
        data-test="recipient-suggestions"
        hidden={!showDropdown}
        className={cn(
          "absolute left-0 right-0 top-full z-50 mt-1",
          "max-h-70 overflow-y-auto",
          "rounded-lg border border-border bg-popover shadow-lg",
        )}>
        {isSearching && (
          <div
            aria-hidden="true"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            {__("Searching…", "pressedmail")}
          </div>
        )}

        <div
          id={suggestionsId}
          role="listbox"
          aria-label={sprintf(
            /* translators: %s: the recipient field, for example "To" or "Cc". */
            __("%s suggestions", "pressedmail"),
            label,
          )}
          hidden={!listboxOpen}>
          {contactSuggestions.length > 0 && (
            <div role="group" aria-labelledby={`${suggestionsId}-contacts`}>
              <div
                id={`${suggestionsId}-contacts`}
                className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {__("Contacts", "pressedmail")}
              </div>
              {contactSuggestions.map((suggestion) => {
                const actualIndex = suggestions.indexOf(suggestion);
                return (
                  <div
                    key={suggestion.id}
                    id={optionId(actualIndex)}
                    role="option"
                    aria-selected={actualIndex === selectedIndex}
                    data-test={`recipient-suggestion-${suggestion.id}`}
                    // Keep focus in the input, so a click does not blur it and
                    // commit the half-typed text as a second recipient.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors",
                      "hover:bg-accent",
                      actualIndex === selectedIndex && "bg-accent",
                    )}>
                    {suggestion.avatarUrl ? (
                      <img
                        src={suggestion.avatarUrl}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium text-white",
                          getRecipientAvatarColor(suggestion.primaryText),
                        )}>
                        {getRecipientInitials(suggestion.primaryText)}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {suggestion.primaryText}
                      </p>
                      {suggestion.secondaryText && (
                        <p className="text-xs text-muted-foreground truncate">
                          {suggestion.secondaryText}
                        </p>
                      )}
                    </div>
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                );
              })}
            </div>
          )}

          {listSuggestions.length > 0 && (
            <div role="group" aria-labelledby={`${suggestionsId}-lists`}>
              <div
                id={`${suggestionsId}-lists`}
                className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider border-t border-border">
                {__("Lists", "pressedmail")}
              </div>
              {listSuggestions.map((suggestion) => {
                const actualIndex = suggestions.indexOf(suggestion);
                return (
                  <div
                    key={suggestion.id}
                    id={optionId(actualIndex)}
                    role="option"
                    aria-selected={actualIndex === selectedIndex}
                    data-test={`recipient-suggestion-${suggestion.id}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors",
                      "hover:bg-accent",
                      actualIndex === selectedIndex && "bg-accent",
                    )}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
                      <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {suggestion.primaryText}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sprintf(
                          _n(
                            "%d member",
                            "%d members",
                            suggestion.memberCount ?? 0,
                            "pressedmail",
                          ),
                          suggestion.memberCount ?? 0,
                        )}
                      </p>
                    </div>
                    <Users className="h-4 w-4 text-purple-500 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecipientInput;
