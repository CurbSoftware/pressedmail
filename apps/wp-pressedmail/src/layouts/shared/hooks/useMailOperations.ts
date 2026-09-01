/**
 * useMailOperations Hook
 *
 * Shared business logic for mail operations across all layouts.
 * Uses InboxContext services + ComposerContext for compose state.
 *
 * @since 2.0.0
 * @updated 3.0.0 - Fully migrated to InboxContext + ComposerContext
 */

import { useCallback, useMemo } from "react";
import { __ } from "@wordpress/i18n";
import { useAppContext } from "@/context/AppProvider";
import {
  useInbox,
  useInboxState,
  useMessageOperations as useServiceMessageOperations,
  useFilterOperations,
} from "@/context/InboxContext";
import { DEFAULT_COMPOSE_DATA, useComposer } from "@/context/composer";
import { useFolderOperations } from "@/layouts/shared/hooks/useFolderOperations";
import { appMessage } from "@/context/toast";
import type { EmailMessage, ComposeData } from "@/types";
import type { FolderTarget } from "@/services/interfaces";
import type { MutationTarget } from "@/lib/folder-target";
import { getUserPreferencesSnapshot } from "@/hooks/useUserPreferences";
import { nextVisibleMessageAfterRemoval } from "@/lib/preference-behavior";

/**
 * Compose mode type.
 */
export type ComposeMode = "new" | "reply" | "replyAll" | "forward";

/**
 * Mail operation results.
 */
export interface MailOperationResult {
  success: boolean;
  error?: string;
}

/**
 * Return type for useMailOperations hook.
 */
export interface UseMailOperationsReturn {
  // State
  messages: EmailMessage[];
  filteredMessages: EmailMessage[];
  selectedMessage: EmailMessage | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isSending: boolean;
  error: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;

  // Message Selection
  selectMessage: (message: EmailMessage | null) => void;
  clearSelectedMessage: () => void;

  // Read Status
  markAsRead: (messageIds: string[]) => Promise<MailOperationResult>;
  markAsUnread: (messageIds: string[]) => Promise<MailOperationResult>;
  toggleRead: (message: EmailMessage) => Promise<MailOperationResult>;

  // Message Actions
  archiveMessages: (messageIds: string[]) => Promise<MailOperationResult>;
  deleteMessages: (messageIds: string[]) => Promise<MailOperationResult>;
  moveToFolder: (
    messageIds: string[],
    targetFolder: MutationTarget,
  ) => Promise<MailOperationResult>;
  toggleStar: (message: EmailMessage) => Promise<MailOperationResult>;
  toggleImportant: (message: EmailMessage) => Promise<MailOperationResult>;

  // Compose Operations
  startCompose: (mode: ComposeMode, message?: EmailMessage) => void;
  getComposeData: () => ComposeData;
  updateComposeData: (data: Partial<ComposeData>) => void;
  clearComposeData: () => void;
  sendMessage: (data: ComposeData) => Promise<MailOperationResult>;

  // Loading Operations
  refreshMessages: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;

  // Filter Operations
  filterByReadStatus: (status: "all" | "read" | "unread") => void;
  applyFilters: (filters: string[]) => void;
  clearFilters: () => void;
}

/**
 * Hook providing shared mail operations for all layout components.
 */
export function useMailOperations(): UseMailOperationsReturn {
  const appContext = useAppContext();
  const inbox = useInbox();
  const inboxState = useInboxState();
  const serviceMessageOps = useServiceMessageOperations();
  const filterOps = useFilterOperations();
  const composer = useComposer();

  // Folder count updates for optimistic UI
  const { decrementUnseenCount, adjustFolderCounts, selectedFolder } =
    useFolderOperations();

  // Message Selection: via InboxContext (sync effect updates AppProvider)
  const selectMessage = useCallback(
    (message: EmailMessage | null) => {
      if (message) {
        serviceMessageOps.selectMessage(message);
      } else {
        serviceMessageOps.clearSelection();
      }
    },
    [serviceMessageOps],
  );

  const clearSelectedMessage = useCallback(() => {
    serviceMessageOps.clearSelection();
  }, [serviceMessageOps]);

  // ============== Message Operations ==============

  const markAsRead = useCallback(
    async (messageIds: string[]): Promise<MailOperationResult> => {
      try {
        let result: MailOperationResult;
        if (messageIds.length === 1) {
          const r = await serviceMessageOps.markAsRead(messageIds[0]!);
          result = { success: r.success, error: r.error };
        } else {
          const r = await serviceMessageOps.batchMarkRead(messageIds);
          result = {
            success: r.success,
            error:
              r.error ||
              (r.failedIds.length > 0
                ? `${r.failedIds.length} operations failed`
                : undefined),
          };
        }
        if (result.success && selectedFolder) {
          for (let i = 0; i < messageIds.length; i++) {
            decrementUnseenCount(selectedFolder);
          }
        }
        return result;
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to mark as read",
        };
      }
    },
    [serviceMessageOps, selectedFolder, decrementUnseenCount],
  );

  const markAsUnread = useCallback(
    async (messageIds: string[]): Promise<MailOperationResult> => {
      try {
        if (messageIds.length === 1) {
          const result = await serviceMessageOps.markAsUnread(messageIds[0]!);
          return { success: result.success, error: result.error };
        } else {
          const result = await serviceMessageOps.batchMarkUnread(messageIds);
          return {
            success: result.success,
            error:
              result.error ||
              (result.failedIds.length > 0
                ? `${result.failedIds.length} operations failed`
                : undefined),
          };
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error ? err.message : "Failed to mark as unread",
        };
      }
    },
    [serviceMessageOps],
  );

  const toggleRead = useCallback(
    async (message: EmailMessage): Promise<MailOperationResult> => {
      try {
        const isRead = message.read || message.is_read;
        const result = isRead
          ? await serviceMessageOps.markAsUnread(message.id)
          : await serviceMessageOps.markAsRead(message.id);
        return { success: result.success, error: result.error };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to toggle read",
        };
      }
    },
    [serviceMessageOps],
  );

  const moveToFolder = useCallback(
    async (
      messageIds: string[],
      targetFolder: MutationTarget,
    ): Promise<MailOperationResult> => {
      try {
        let result: MailOperationResult;
        // Count adjustments follow the messages that actually moved. A partial
        // failure previously adjusted NOTHING, drifting every badge.
        let movedCount = 0;
        if (messageIds.length === 1) {
          const r = await serviceMessageOps.moveMessage(
            messageIds[0]!,
            targetFolder,
          );
          result = { success: r.success, error: r.error };
          movedCount = r.success ? 1 : 0;
        } else {
          const r = await serviceMessageOps.batchMove(messageIds, targetFolder);
          result = {
            success: r.success,
            error:
              r.error ||
              (r.failedIds.length > 0
                ? `${r.failedIds.length} operations failed`
                : undefined),
          };
          movedCount = r.successCount ?? 0;
        }
        if (movedCount > 0 && selectedFolder) {
          const targetPath =
            typeof targetFolder === "string" ? targetFolder : targetFolder.path;
          for (let i = 0; i < movedCount; i++) {
            adjustFolderCounts(selectedFolder, targetPath);
          }
        }
        return result;
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to move messages",
        };
      }
    },
    [serviceMessageOps, selectedFolder, adjustFolderCounts],
  );

  const applyAfterRemoval = useCallback(
    (action: "message_list" | "next_message", messageIds: string[]) => {
      const selectedId = inboxState.selectedMessage
        ? String(
            inboxState.selectedMessage.uid ?? inboxState.selectedMessage.id,
          )
        : null;
      if (selectedId && !messageIds.includes(selectedId)) {
        return;
      }
      if (action === "next_message") {
        const next = nextVisibleMessageAfterRemoval(
          inboxState.messages,
          messageIds,
        );
        if (next) {
          serviceMessageOps.selectMessage(next);
          return;
        }
      }
      serviceMessageOps.clearSelection();
    },
    [inboxState.messages, inboxState.selectedMessage, serviceMessageOps],
  );

  const archiveMessages = useCallback(
    async (messageIds: string[]): Promise<MailOperationResult> => {
      try {
        const results = await Promise.allSettled(
          messageIds.map((id) => serviceMessageOps.archiveMessage(id)),
        );

        const failed = results.filter(
          (r) =>
            r.status === "rejected" ||
            (r.status === "fulfilled" && !r.value.success),
        );
        const firstFailure = failed[0];
        const firstError =
          firstFailure?.status === "fulfilled"
            ? firstFailure.value.error
            : firstFailure?.reason instanceof Error
              ? firstFailure.reason.message
              : undefined;

        const success = failed.length === 0;
        if (success) {
          applyAfterRemoval(
            getUserPreferencesSnapshot().after_archive_action,
            messageIds,
          );
        }

        return {
          success,
          error:
            failed.length > 0
              ? firstError || `${failed.length} archive operations failed`
              : undefined,
        };
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error ? err.message : "Failed to archive messages",
        };
      }
    },
    [serviceMessageOps, applyAfterRemoval],
  );

  const deleteMessages = useCallback(
    async (messageIds: string[]): Promise<MailOperationResult> => {
      try {
        if (getUserPreferencesSnapshot().confirm_delete) {
          const confirmed = window.confirm(
            __("Delete the selected email?", "pressedmail"),
          );
          if (!confirmed) {
            return { success: false };
          }
        }
        if (messageIds.length === 1) {
          const result = await serviceMessageOps.deleteMessage(messageIds[0]!);
          if (result.success) {
            applyAfterRemoval(
              getUserPreferencesSnapshot().after_delete_action,
              messageIds,
            );
          }
          return { success: result.success, error: result.error };
        } else {
          const result = await serviceMessageOps.batchDelete(messageIds);
          if (result.success) {
            applyAfterRemoval(
              getUserPreferencesSnapshot().after_delete_action,
              messageIds,
            );
          }
          return {
            success: result.success,
            error:
              result.error ||
              (result.failedIds.length > 0
                ? `${result.failedIds.length} delete operations failed`
                : undefined),
          };
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error ? err.message : "Failed to delete messages",
        };
      }
    },
    [serviceMessageOps, applyAfterRemoval],
  );

  const toggleStar = useCallback(
    async (message: EmailMessage): Promise<MailOperationResult> => {
      try {
        const result = await serviceMessageOps.toggleStar(message.id);
        return { success: result.success, error: result.error };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to toggle star",
        };
      }
    },
    [serviceMessageOps],
  );

  const toggleImportant = useCallback(
    async (message: EmailMessage): Promise<MailOperationResult> => {
      try {
        const result = await serviceMessageOps.toggleImportant(message.id);
        return { success: result.success, error: result.error };
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error ? err.message : "Failed to toggle importance",
        };
      }
    },
    [serviceMessageOps],
  );

  // ============== Compose Operations (via ComposerContext) ==============

  const startCompose = useCallback(
    (mode: ComposeMode, message?: EmailMessage) => {
      if (mode === "new") {
        composer.setComposeData({ ...DEFAULT_COMPOSE_DATA });
        return;
      }

      if (!message) return;

      const newComposeData: ComposeData & { is_reply?: boolean } = {
        ...DEFAULT_COMPOSE_DATA,
        mode: mode === "replyAll" ? "reply-all" : mode,
      };

      if (mode === "reply" || mode === "replyAll") {
        newComposeData.to = message.from || "";
        newComposeData.subject = message.subject?.startsWith("Re:")
          ? message.subject
          : `Re: ${message.subject}`;
        newComposeData.is_reply = true;
      }

      if (mode === "replyAll") {
        newComposeData.cc = message.cc || "";
      }

      if (mode === "forward") {
        newComposeData.subject = message.subject?.startsWith("Fwd:")
          ? message.subject
          : `Fwd: ${message.subject}`;
        newComposeData.body = `\n\n---------- Forwarded message ----------\n${message.body || ""}`;
      }

      composer.setComposeData(newComposeData);
    },
    [composer],
  );

  const getComposeData = useCallback(
    () => composer.composeData,
    [composer.composeData],
  );

  const updateComposeData = useCallback(
    (data: Partial<ComposeData>) => {
      composer.setComposeData((prev) => ({ ...prev, ...data }));
    },
    [composer],
  );

  const clearComposeData = useCallback(() => {
    composer.resetComposeData();
  }, [composer]);

  const sendMessage = useCallback(
    async (_data: ComposeData): Promise<MailOperationResult> => {
      return { success: true };
    },
    [],
  );

  // ============== Loading Operations ==============

  const refreshMessages = useCallback(async () => {
    appMessage("Refreshing messages from server...", "warning");
    await inbox.refreshMessages();
  }, [inbox]);

  const loadMoreMessages = useCallback(async () => {
    await inbox.loadMore();
  }, [inbox]);

  // ============== Filter Operations ==============

  const filterByReadStatus = useCallback(
    (status: "all" | "read" | "unread") => {
      // Read-status and the virtual-folder scopes (Starred / Important /
      // Scheduled) live in the SAME activeFilters object, so this must MERGE
      // rather than replace, clearing everything would silently drop the
      // active view (e.g. "Unread" while viewing Starred must stay starred).
      const { readStatus: _drop, ...rest } = filterOps.activeFilters;

      if (status === "all") {
        // "All mail" here means "no read-status constraint", not "clear the
        // whole view", preserve any starred/important/tag/search scope.
        filterOps.applyFilters(rest);
      } else {
        filterOps.applyFilters({ ...rest, readStatus: status });
      }
    },
    [filterOps],
  );

  const applyFilters = useCallback((_filters: string[]) => {
    // Placeholder for label-based filtering
  }, []);

  const clearFilters = useCallback(() => {
    filterOps.clearFilters();
  }, [filterOps]);

  return useMemo(
    () => ({
      // State
      messages: inboxState.messages,
      filteredMessages: inboxState.messages,
      selectedMessage: inboxState.selectedMessage,
      isLoading: inboxState.isLoading,
      isRefreshing: inboxState.isLoading,
      isSending: composer.isSending,
      error: inboxState.error,
      hasMore: inboxState.hasMore,
      isLoadingMore: inboxState.isLoadingMore,

      // Message Selection
      selectMessage,
      clearSelectedMessage,

      // Read Status
      markAsRead,
      markAsUnread,
      toggleRead,

      // Message Actions
      archiveMessages,
      deleteMessages,
      moveToFolder,
      toggleStar,
      toggleImportant,

      // Compose Operations
      startCompose,
      getComposeData,
      updateComposeData,
      clearComposeData,
      sendMessage,

      // Loading Operations
      refreshMessages,
      loadMoreMessages,

      // Filter Operations
      filterByReadStatus,
      applyFilters,
      clearFilters,
    }),
    [
      inboxState.messages,
      inboxState.selectedMessage,
      inboxState.isLoading,
      inboxState.error,
      inboxState.hasMore,
      inboxState.isLoadingMore,
      composer.isSending,
      selectMessage,
      clearSelectedMessage,
      markAsRead,
      markAsUnread,
      toggleRead,
      archiveMessages,
      deleteMessages,
      moveToFolder,
      toggleStar,
      toggleImportant,
      startCompose,
      getComposeData,
      updateComposeData,
      clearComposeData,
      sendMessage,
      refreshMessages,
      loadMoreMessages,
      filterByReadStatus,
      applyFilters,
      clearFilters,
    ],
  );
}

export default useMailOperations;
