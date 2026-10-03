/**
 * Free build sender-contact hook.
 *
 * Contacts ship in the Pro edition only. Every caller compiles its contact
 * control behind `__ENABLE_CONTACTS__`, so Free never renders one; this stub
 * only satisfies the shared call sites without bundling the contact client.
 */
// Declared here, not imported: the Free source export publishes only the Free
// module graph, and the Pro hook is not in it.
export interface SenderContactState {
  available: boolean;
  existingContact: { id: number } | null;
  canCreate: boolean;
  pending: boolean;
  confirmRemoveOpen: boolean;
  setConfirmRemoveOpen: (open: boolean) => void;
  addSender: () => Promise<void>;
  removeSender: () => Promise<void>;
}

const NOOP = async () => {};

const FREE_STATE: SenderContactState = {
  available: false,
  existingContact: null,
  canCreate: false,
  pending: false,
  confirmRemoveOpen: false,
  setConfirmRemoveOpen: () => {},
  addSender: NOOP,
  removeSender: NOOP,
};

export function useSenderContact(
  _senderEmail: string,
  _senderName: string,
): SenderContactState {
  return FREE_STATE;
}
