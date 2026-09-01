"use client";

/**
 * Shared Drag and Drop Provider
 *
 * Provides drag-and-drop context for email list and sidebar interaction.
 * Enables dragging emails to folders/labels. Shared across all layouts.
 * Supports multi-select: dragging one selected email moves all selected.
 *
 * @since 2.0.0
 * @updated 3.0.0 - Moved from PressedG to shared components
 * @updated 3.1.0 - Multi-select drag support, same-folder guard, drag count
 */

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInboxState, useInbox } from "@/context/InboxContext";
import { useMailOperations } from "@/layouts/shared/hooks/useMailOperations";
import type { EmailMessage } from "@/types";
import { getMessageIdentityKey } from "@/lib/message-identity";

interface DragDropContextValue {
  isDragging: boolean;
  draggedMessage: EmailMessage | null;
  draggedMessageIds: string[];
  dragCount: number;
  activeDropZone: string | null;
}

const DragDropContext = React.createContext<DragDropContextValue>({
  isDragging: false,
  draggedMessage: null,
  draggedMessageIds: [],
  dragCount: 0,
  activeDropZone: null,
});

export const useDragDropContext = () => React.useContext(DragDropContext);

export interface EmailDragDropProviderProps {
  children: React.ReactNode;
}

export interface StableFolderDropTarget {
  accountId: number | null;
  folderId: number | null;
  path: string;
}

export function readFolderDropTarget(
  id: string,
  data: Record<string, unknown> | undefined,
): StableFolderDropTarget | null {
  const target = data?.folderTarget;
  if (target && typeof target === "object") {
    const candidate = target as Record<string, unknown>;
    if (
      typeof candidate.accountId === "number" &&
      typeof candidate.folderId === "number" &&
      typeof candidate.path === "string"
    ) {
      return {
        accountId: candidate.accountId,
        folderId: candidate.folderId,
        path: candidate.path,
      };
    }
  }
  if (id.startsWith("folder-")) {
    return { accountId: null, folderId: null, path: id.replace("folder-", "") };
  }
  return null;
}

/**
 * Email Drag and Drop Provider
 *
 * Wraps children with DndContext and provides:
 * - Drag overlay for visual feedback
 * - Drop zone tracking
 * - Message-to-folder move operations
 * - Multi-select drag (moves all selected emails)
 */
export function EmailDragDropProvider({
  children,
}: EmailDragDropProviderProps) {
  const { messages: filteredMessages } = useInboxState();
  const { selectedFolder } = useInbox();
  const { moveToFolder } = useMailOperations();

  const [isDragging, setIsDragging] = React.useState(false);
  const [draggedMessage, setDraggedMessage] =
    React.useState<EmailMessage | null>(null);
  const [draggedMessageIds, setDraggedMessageIds] = React.useState<string[]>(
    [],
  );
  const [dragCount, setDragCount] = React.useState(0);
  const [activeDropZone, setActiveDropZone] = React.useState<string | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const messageId = active.id as string;
      const message = filteredMessages.find(
        (m) => getMessageIdentityKey(m) === messageId,
      );

      // Read multi-select data from drag source
      const selectedIds = (active.data.current?.selectedIds as
        | string[]
        | undefined) ?? [messageId];
      const count = (active.data.current?.dragCount as number | undefined) ?? 1;

      setIsDragging(true);
      setDraggedMessage(message || null);
      setDraggedMessageIds(selectedIds);
      setDragCount(count);
    },
    [filteredMessages],
  );

  const handleDragOver = React.useCallback((event: DragOverEvent) => {
    const { over } = event;
    setActiveDropZone(over?.id ? String(over.id) : null);
  }, []);

  const handleDragEnd = React.useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      // Capture IDs before resetting state
      const idsToMove = (active?.data.current?.selectedIds as
        | string[]
        | undefined) ?? [String(active.id)];

      setIsDragging(false);
      setDraggedMessage(null);
      setDraggedMessageIds([]);
      setDragCount(0);
      setActiveDropZone(null);

      if (over && active) {
        const target = readFolderDropTarget(
          String(over.id),
          over.data.current as Record<string, unknown> | undefined,
        );

        if (target) {
          const folderPath = target.path;

          // Same-folder guard: skip if dropping on the current folder
          if (folderPath === selectedFolder) return;

          await moveToFolder(
            idsToMove,
            target.folderId === null
              ? folderPath
              : {
                  accountId: target.accountId!,
                  folderId: target.folderId,
                  path: target.path,
                },
          );
        }
      }
    },
    [moveToFolder, selectedFolder],
  );

  const handleDragCancel = React.useCallback(() => {
    setIsDragging(false);
    setDraggedMessage(null);
    setDraggedMessageIds([]);
    setDragCount(0);
    setActiveDropZone(null);
  }, []);

  const contextValue = React.useMemo(
    () => ({
      isDragging,
      draggedMessage,
      draggedMessageIds,
      dragCount,
      activeDropZone,
    }),
    [isDragging, draggedMessage, draggedMessageIds, dragCount, activeDropZone],
  );

  return (
    <DragDropContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}>
        {children}

        <DragOverlay>
          {isDragging && draggedMessage && (
            <DragOverlayContent message={draggedMessage} count={dragCount} />
          )}
        </DragOverlay>
      </DndContext>
    </DragDropContext.Provider>
  );
}

function DragOverlayContent({
  message,
  count,
}: {
  message: EmailMessage;
  count: number;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        "bg-card border border-primary/50 rounded-lg shadow-lg",
        "max-w-[300px] cursor-grabbing",
      )}>
      <Mail className="h-5 w-5 text-primary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">
          {message.from || "Unknown sender"}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {message.subject || "(No subject)"}
        </div>
      </div>
      {count > 1 && (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
          {count}
        </span>
      )}
    </div>
  );
}

export default EmailDragDropProvider;
