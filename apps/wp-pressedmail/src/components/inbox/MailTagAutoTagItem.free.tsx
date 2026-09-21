/**
 * Free build tag menu.
 *
 * Auto-tagging ships in the Pro edition only, so the Free plugin has no entry
 * to show and no AI provider to call. Returning null keeps the Free bundle free
 * of the Pro icon, the Pro copy and the menu separator that belonged to them.
 */
export interface MailTagAutoTagItemProps {
  /** The menu is closing; the caller drops its own open state. */
  onDismiss: () => void;
  onAutoTag?: () => void | Promise<void>;
  disabled?: boolean;
  isAutoTagging?: boolean;
}

export function MailTagAutoTagItem(
  _props: MailTagAutoTagItemProps,
): null {
  return null;
}

export default MailTagAutoTagItem;
