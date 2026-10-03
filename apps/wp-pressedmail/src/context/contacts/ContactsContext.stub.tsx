import { createContext, type ReactNode } from "react";

/**
 * The Free build's stand-in for the contacts module.
 *
 * Free keeps no contacts. Every hook answers "none" and carries no member
 * names, so nothing about the feature reaches the Free bundle. Shared code
 * reads contacts only through `useOptionalContactList()` behind
 * `__ENABLE_CONTACTS__`, which compiles out here.
 */
const ContactsContext = /* @__PURE__ */ createContext<null>(null);

export function ContactsProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useContacts(): null {
  return null;
}

export function useOptionalContacts(): null {
  return null;
}

export function useContactCapabilities(): null {
  return null;
}

export function useContactsAvailable(): boolean {
  return false;
}

export function useCanCreateContact(): boolean {
  return false;
}

export function useContactsByList(_listId: number | null): never[] {
  return [];
}

export function useFavoriteContacts(): never[] {
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
