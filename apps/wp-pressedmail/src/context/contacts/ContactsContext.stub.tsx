import { createContext, type ReactNode } from "react";
import type {
  Contact,
  ContactCapabilities,
  ContactsContextValue,
} from "@/types/contacts";

const DISABLED_MESSAGE = "Contacts are not included in this build.";

const EMPTY_CAPABILITIES: ContactCapabilities = {
  available: false,
  create: false,
  import: false,
  export: false,
  max_contacts: 0,
  is_unlimited: false,
  current_count: 0,
  remaining: 0,
  max_lists: 0,
  lists_available: false,
  list_count: 0,
  lists_remaining: 0,
};

const EMPTY_CONTEXT: ContactsContextValue = {
  contacts: [],
  lists: [],
  loading: false,
  error: null,
  capabilities: EMPTY_CAPABILITIES,
  fetchContacts: async () => {},
  getContact: async () => null,
  createContact: async () => ({ success: false, error: DISABLED_MESSAGE }),
  updateContact: async () => ({ success: false, error: DISABLED_MESSAGE }),
  replaceContactListMembership: async () => ({
    success: false,
    error: DISABLED_MESSAGE,
  }),
  deleteContact: async () => ({ success: false, error: DISABLED_MESSAGE }),
  searchContacts: async () => [],
  toggleFavorite: async () => ({ success: false, error: DISABLED_MESSAGE }),
  fetchLists: async () => {},
  createList: async () => ({ success: false, error: DISABLED_MESSAGE }),
  updateList: async () => ({ success: false, error: DISABLED_MESSAGE }),
  deleteList: async () => ({ success: false, error: DISABLED_MESSAGE }),
  addToList: async () => ({ success: false, error: DISABLED_MESSAGE }),
  removeFromList: async () => ({ success: false, error: DISABLED_MESSAGE }),
  getContactActivities: async () => ({
    success: false,
    error: DISABLED_MESSAGE,
  }),
  addContactActivity: async () => ({ success: false, error: DISABLED_MESSAGE }),
  getContactRecentEmails: async () => ({
    success: false,
    error: DISABLED_MESSAGE,
  }),
  getCustomFields: async () => ({ success: false, error: DISABLED_MESSAGE }),
  createCustomField: async () => ({ success: false, error: DISABLED_MESSAGE }),
  deleteCustomField: async () => ({ success: false, error: DISABLED_MESSAGE }),
  importContacts: async () => ({ success: false, error: DISABLED_MESSAGE }),
  exportContacts: async () => ({ success: false, error: DISABLED_MESSAGE }),
  getSyncStatus: async () => ({ success: false, error: DISABLED_MESSAGE }),
  getSyncAuthUrl: async () => ({ success: false, error: DISABLED_MESSAGE }),
  connectSyncProvider: async () => ({
    success: false,
    error: DISABLED_MESSAGE,
  }),
  connectCardDAV: async () => ({ success: false, error: DISABLED_MESSAGE }),
  disconnectSyncProvider: async () => ({
    success: false,
    error: DISABLED_MESSAGE,
  }),
  triggerSync: async () => ({ success: false, error: DISABLED_MESSAGE }),
  allContactKeywords: [],
  renameContactKeyword: async () => ({
    success: false,
    error: DISABLED_MESSAGE,
  }),
  deleteContactKeyword: async () => ({
    success: false,
    error: DISABLED_MESSAGE,
  }),
  flagFilter: [],
  toggleFlagFilter: () => {},
  clearFlagFilter: () => {},
};

const ContactsContext = createContext<ContactsContextValue>(EMPTY_CONTEXT);

export function ContactsProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useContacts(): ContactsContextValue {
  return EMPTY_CONTEXT;
}

/**
 * Null, matching the Pro hook's "no provider mounted" answer.
 *
 * Callers use this when contacts are optional, the reading-pane action row
 * offers an add-sender-to-contacts control and must render in this build,
 * where there are no contacts at all. Returning null is what makes it hide
 * itself rather than offer an action that cannot work.
 */
export function useOptionalContacts(): ContactsContextValue | null {
  return null;
}

export function useContactCapabilities(): ContactCapabilities {
  return EMPTY_CAPABILITIES;
}

export function useContactsAvailable(): boolean {
  return false;
}

export function useCanCreateContact(): boolean {
  return false;
}

export function useContactsByList(_listId: number | null): Contact[] {
  return [];
}

export function useFavoriteContacts(): Contact[] {
  return [];
}

export function useCanCreateList(): boolean {
  return false;
}

export function useRemainingContacts(): number {
  return 0;
}

export function useRemainingLists(): number {
  return 0;
}

export function useContactsUnlimited(): boolean {
  return false;
}

export default ContactsContext;
