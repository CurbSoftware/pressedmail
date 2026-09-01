/**
 * Selection Checkbox Component
 *
 * Individual checkbox for selecting emails in the mail list.
 * Prevents click propagation to avoid triggering email selection.
 *
 * @since 1.6.0
 */

import { useCallback } from "react";
import { __ } from "@wordpress/i18n";
import { Checkbox } from "@kit/ui/plugin";
import { cn } from "@/lib/utils";
import { useEmailSelection } from "@/context/selection";

interface SelectionCheckboxProps {
  /** Email message ID */
  messageId: string | number;
  /** Render a smaller checkbox */
  small?: boolean;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Selection Checkbox for individual email rows.
 */
export function SelectionCheckbox({
  messageId,
  small,
  className,
}: SelectionCheckboxProps) {
  const { isSelected, toggleSelection } = useEmailSelection();

  const checked = isSelected(messageId);

  /**
   * Handle checkbox change, preventing event propagation.
   */
  const handleCheckedChange = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleSelection(messageId);
    },
    [messageId, toggleSelection],
  );

  return (
    <div
      className={cn("flex items-center justify-center", className)}
      onClick={handleCheckedChange}>
      <Checkbox
        checked={checked}
        aria-label={
          checked
            ? __("Deselect email", "pressedmail")
            : __("Select email", "pressedmail")
        }
        className={cn(
          "pm-list-selection-checkbox pointer-events-none",
          small && "size-3 [&>svg]:size-2.5",
        )}
      />
    </div>
  );
}

export default SelectionCheckbox;
