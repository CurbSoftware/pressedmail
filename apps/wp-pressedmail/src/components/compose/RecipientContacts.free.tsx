import type { Recipient, RecipientSuggestion } from "@/types/recipients";

/**
 * Free ships no contacts, so the recipient field offers no suggestions and no
 * picker: the field is tokens and typed addresses only. Same exports as the
 * Pro module so the physical `.active` shim falls back here, never to Pro.
 */
const NO_SUGGESTIONS: {
  suggestions: RecipientSuggestion[];
  isSearching: boolean;
} = { suggestions: [], isSearching: false };

export function useRecipientSuggestions(
  _query: string,
  _options: { existing: Recipient[]; showListSuggestions: boolean },
) {
  return NO_SUGGESTIONS;
}

export function RecipientContactsButton(_props: {
  label: string;
  existingRecipients: Recipient[];
  showLists: boolean;
  onSelect: (recipients: Recipient[]) => void;
}) {
  return null;
}
