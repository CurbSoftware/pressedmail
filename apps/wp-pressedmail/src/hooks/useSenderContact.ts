import * as React from "react";

import { toast } from "@kit/ui/plugin";
import { __, sprintf } from "@wordpress/i18n";

import { useOptionalContacts } from "@/context/contacts";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { parseSenderEmail } from "@/lib/mail-utils";

/**
 * Add-or-remove the message sender as a contact.
 *
 * Lifted out of the reading pane so the control can live in the reader's
 * action row on desktop while mobile, which renders MailDisplay with no
 * action bar, keeps its own copy. Two call sites, one implementation, so the
 * add/remove behaviour cannot drift between them.
 */
export interface SenderContactState {
  /** Contacts are a Pro feature; false hides the control entirely. */
  available: boolean;
  /** The sender's existing contact record, when they already are one. */
  existingContact: { id: number } | null;
  /** False when the plan's contact limit is reached. */
  canCreate: boolean;
  pending: boolean;
  confirmRemoveOpen: boolean;
  setConfirmRemoveOpen: (open: boolean) => void;
  addSender: () => Promise<void>;
  removeSender: () => Promise<void>;
}

export function useSenderContact(
  rawSenderEmail: string,
  senderName: string,
): SenderContactState {
  // Optional on purpose: the reading-pane toolbar renders in Free builds and
  // in tests that mount no ContactsProvider. No provider simply means the
  // control is unavailable.
  const ctx = useOptionalContacts();
  const { preferences } = useUserPreferences();
  const contacts = ctx?.contacts;
  const available = ctx?.capabilities?.available ?? false;
  const canCreate = ctx?.capabilities?.create ?? false;
  const [confirmRemoveOpen, setConfirmRemoveOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  // Callers pass `message.email || message.from`, and not every backend path
  // fills `email` with a bare address, the snoozed-message list, for one,
  // puts the whole `From` header in both. An unparsed "Ada <ada@x.com>" never
  // matches a stored contact (so the indicator stays dark for someone who IS a
  // contact) and, once sanitize_email() has mangled it server-side, creates a
  // contact at a junk address. The list already reads senders through this
  // helper; the reading pane now does too.
  const senderEmail = React.useMemo(
    () => (rawSenderEmail ? parseSenderEmail({ email: rawSenderEmail }) : ""),
    [rawSenderEmail],
  );

  const existingContact = React.useMemo(() => {
    if (!senderEmail || !contacts) return null;
    const normalized = senderEmail.toLowerCase();
    return contacts.find((c) => c.email.toLowerCase() === normalized) ?? null;
  }, [contacts, senderEmail]);

  const addSender = React.useCallback(async () => {
    if (!senderEmail || pending || !ctx) return;
    setPending(true);
    // "Ada Lovelace" → first/last; a bare address stays nameless rather than
    // becoming a contact whose first name is their own email.
    const parts = senderName.trim().split(/\s+/).filter(Boolean);
    const first = parts[0] && parts[0] !== senderEmail ? parts[0] : undefined;
    const last = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
    try {
      // createContact resolves { success: false } instead of throwing, and for
      // a long time nothing here read that: a server-side failure. An install
      // whose contacts table predates the `source` column answered every
      // insert with a 500, looked exactly like a button that did nothing.
      // The user's default list, when set and still existing; a stale id
      // (deleted list) is dropped silently rather than failing the create.
      const defaultListId = preferences.contacts_default_list_id;
      const defaultLists =
        defaultListId > 0 && ctx.lists.some((list) => list.id === defaultListId)
          ? [defaultListId]
          : undefined;
      const result = await ctx.createContact({
        email: senderEmail,
        first_name: first,
        last_name: last,
        ...(defaultLists ? { lists: defaultLists } : {}),
      });

      if (result?.success) {
        toast.success(
          sprintf(
            /* translators: %s: sender email address */
            __("%s added to contacts.", "pressedmail"),
            senderEmail,
          ),
        );
      } else {
        toast.error(
          result?.error || __("Could not add this contact.", "pressedmail"),
        );
      }
    } catch (error) {
      console.error("Failed to add sender to contacts:", error);
      toast.error(__("Could not add this contact.", "pressedmail"));
    } finally {
      setPending(false);
    }
  }, [
    ctx,
    pending,
    preferences.contacts_default_list_id,
    senderEmail,
    senderName,
  ]);

  const removeSender = React.useCallback(async () => {
    if (!existingContact || pending || !ctx) return;
    setPending(true);
    try {
      const result = await ctx.deleteContact(existingContact.id);

      if (result?.success) {
        toast.success(__("Contact removed.", "pressedmail"));
      } else {
        toast.error(
          result?.error || __("Could not remove this contact.", "pressedmail"),
        );
      }
    } catch (error) {
      console.error("Failed to remove sender from contacts:", error);
      toast.error(__("Could not remove this contact.", "pressedmail"));
    } finally {
      setPending(false);
      setConfirmRemoveOpen(false);
    }
  }, [ctx, existingContact, pending]);

  return {
    available,
    existingContact,
    canCreate,
    pending,
    confirmRemoveOpen,
    setConfirmRemoveOpen,
    addSender,
    removeSender,
  };
}
