"use client";

/**
 * useDraggableEmail Hook
 *
 * Handle-based drag hook for email items. Separates the draggable node ref
 * (the email row) from the drag handle listeners (the sender name).
 * Supports multi-select: if the dragged email is part of a selection,
 * all selected emails are included in the drag data.
 *
 * @since 3.1.0
 */

import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { EmailMessage } from "@/types";
import EmailSelectionContext from "@/context/selection/EmailSelectionContext";
import { getMessageIdentityKey } from "@/lib/message-identity";

export interface UseDraggableEmailOptions {
  /** The email message to make draggable */
  message: EmailMessage;
  /** Disable dragging (e.g., during loading states) */
  disabled?: boolean;
}

export interface UseDraggableEmailReturn {
  /** Ref for the draggable container (the email row) */
  rowRef: (element: HTMLElement | null) => void;
  /** Spread these on the sender name element ONLY (the drag handle) */
  handleListeners: ReturnType<typeof useDraggable>["listeners"];
  /** Accessibility attributes for the handle */
  handleAttributes: ReturnType<typeof useDraggable>["attributes"];
  /** Whether this email is currently being dragged */
  isDragging: boolean;
  /** CSS style for the row during drag (opacity + transform) */
  rowStyle: React.CSSProperties;
  /** Number of emails being dragged (1 for single, N for multi-select) */
  dragCount: number;
}

/**
 * Hook for handle-based email dragging.
 *
 * Usage:
 * ```tsx
 * function EmailRow({ message }) {
 *   const { rowRef, handleListeners, handleAttributes, isDragging, rowStyle } =
 *     useDraggableEmail({ message });
 *
 *   return (
 *     <div ref={rowRef} style={rowStyle}>
 *       <span {...handleListeners} {...handleAttributes} className="cursor-grab">
 *         {senderName}
 *       </span>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDraggableEmail({
  message,
  disabled = false,
}: UseDraggableEmailOptions): UseDraggableEmailReturn {
  // Safely consume selection context (may not be available in all layouts)
  const selectionContext = React.useContext(EmailSelectionContext);

  const messageId = getMessageIdentityKey(message);

  // Determine selected IDs for multi-drag
  const selectedIds = React.useMemo(() => {
    if (!selectionContext) return [];
    const { selectedIds: selIds, isSelected } = selectionContext;
    // Only include selection if this message is part of it
    if (isSelected(messageId) && selIds.size > 1) {
      return Array.from(selIds);
    }
    return [];
  }, [selectionContext, messageId]);

  const dragCount = selectedIds.length > 0 ? selectedIds.length : 1;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: messageId,
      disabled,
      data: {
        type: "email",
        message,
        selectedIds: selectedIds.length > 0 ? selectedIds : [messageId],
        dragCount,
      },
    });

  const rowStyle: React.CSSProperties = React.useMemo(
    () => ({
      transform: CSS.Translate.toString(transform),
      opacity: isDragging ? 0.5 : undefined,
      position: isDragging ? ("relative" as const) : undefined,
      zIndex: isDragging ? 50 : undefined,
    }),
    [transform, isDragging],
  );

  return {
    rowRef: setNodeRef,
    handleListeners: listeners,
    handleAttributes: attributes,
    isDragging,
    rowStyle,
    dragCount,
  };
}

export default useDraggableEmail;
