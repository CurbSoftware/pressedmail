"use client";

/**
 * Draggable Email Item Component
 *
 * An email list item that can be dragged to folders/labels.
 * Shared across all layouts.
 *
 * @since 2.0.0
 * @updated 3.0.0 - Moved from PressedG to shared components
 */

import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { EmailMessage } from "@/types";
import { getMessageIdentityKey } from "@/lib/message-identity";

export interface DraggableEmailItemProps {
  /** The email message */
  message: EmailMessage;
  /** Child content to render */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * Wraps an email list item with drag functionality.
 */
export function DraggableEmailItem({
  message,
  children,
  className,
}: DraggableEmailItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: getMessageIdentityKey(message),
    });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("touch-none", isDragging && "z-50", className)}>
      {children}
    </div>
  );
}

export default DraggableEmailItem;
