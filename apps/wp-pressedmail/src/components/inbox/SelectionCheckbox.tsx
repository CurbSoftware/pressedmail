/**
 * Selection Checkbox Component
 *
 * Individual checkbox for selecting emails in the mail list.
 * Prevents click propagation to avoid triggering email selection.
 *
 * @since 1.6.0
 */

import { useCallback } from "react";
import { __, sprintf } from "@wordpress/i18n";
import { Checkbox } from "@kit/ui/plugin";
import { cn } from "@/lib/utils";
import { useEmailSelection } from "@/context/selection";
import { parseSenderName } from "@/lib/mail-utils";
import type { EmailMessage } from "@/types";

interface SelectionCheckboxProps {
  /** Email message ID */
  messageId: string | number;
  /**
   * The row this checkbox belongs to. Used only to name the control, so a list
   * of fifty checkboxes does not read as fifty copies of "Select email".
   */
  message?: EmailMessage;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Selection Checkbox for individual email rows.
 *
 * Deliberately unstyled beyond the kit's own Checkbox. It used to carry
 * `pm-list-selection-checkbox` and a `small` modifier that shrank it to
 * `size-3` with a `size-2.5` tick; the class name was defined in no stylesheet
 * anywhere, and only one of the four call sites passed `small`, so the same
 * control rendered at two sizes in one product. The accounts dropdown in the
 * header renders the same kit Checkbox at its default size, and that is the
 * one that reads correctly, so this is that.
 */
export function SelectionCheckbox({
  messageId,
  message,
  className,
}: SelectionCheckboxProps) {
  const { isSelected, toggleSelection } = useEmailSelection();

  const checked = isSelected(messageId);

  const handleCheckedChange = useCallback(() => {
    toggleSelection(messageId);
  }, [messageId, toggleSelection]);

  // The name stays put; the state lives in aria-checked, where assistive tech
  // expects it. A label that flipped between "Select" and "Deselect" said the
  // state twice and never said which message.
  const label = message
    ? sprintf(
        /* translators: 1: sender name, 2: subject. */
        __("Select message from %1$s: %2$s", "pressedmail"),
        parseSenderName(message),
        message.subject || __("No subject", "pressedmail"),
      )
    : __("Select message", "pressedmail");

  return (
    <div
      className={cn("flex items-center justify-center", className)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        // Space and Enter belong to the checkbox. The row opens the message on
        // the same keys, so trying to select one used to open it instead.
        if (event.key === " " || event.key === "Enter") {
          event.stopPropagation();
        }
      }}>
      <Checkbox
        checked={checked}
        onCheckedChange={handleCheckedChange}
        aria-label={label}
      />
    </div>
  );
}

export default SelectionCheckbox;
