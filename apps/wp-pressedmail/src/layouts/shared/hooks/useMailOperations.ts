/**
 * useMailOperations Hook
 *
 * Shared business logic for mail operations across all layouts.
 * Uses InboxContext services + ComposerContext for compose state.
 *
 * @since 2.0.0
 * @updated 3.0.0 - Fully migrated to InboxContext + ComposerContext
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { __ } from "@wordpress/i18n";
import { useAppContext } from "@/context/AppProvider";
import {
  useInbox,
  useInboxState,
  useMessageOperations as useServiceMessageOperations,
  useFilterOperations,
} from "@/context/InboxContext";
import { DEFAULT_COMPOSE_DATA, useComposer } from "@/context/composer";
import { appMessage } from "@/context/toast";
import type { EmailMessage, ComposeData } from "@/types";
import type { MutationTarget } from "@/lib/folder-target";
import { getUserPreferencesSnapshot } from "@/hooks/useUserPreferences";
import { nextVisibleMessageAfterRemoval } from "@/lib/preference-behavior";
import {
  getMessageIdentityKey,
  getMessageIdentityRef,
  parseAccountQualifiedToken,
} from "@/lib/message-identity";

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
  requiresRefresh?: boolean;
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

function snapshotMessageIds(ids: readonly string[]): string[] | null {
  const result: string[] = [];
  for (const id of ids) {
    const ref = parseAccountQualifiedToken(id);
    if (ref?.kind !== "message") return null;
    result.push(
      JSON.stringify([ref.accountId, ref.folder, ref.uidValidity, ref.uid]),
    );
  }
  return new Set(result).size === result.length ? result : null;
}

/**
 * Hook providing shared mail operations for all layout components.
 */
export function useMailOperations(): UseMailOperationsReturn {
  const { accounts } = useAppContext();
  const inbox = useInbox();
  const inboxState = useInboxState();
  const serviceMessageOps = useServiceMessageOperations();
  const filterOps = useFilterOperations();
  const composer = useComposer();

  const current = useRef({ inbox, inboxState });
  current.current = { inbox, inboxState };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const identityFailure =
    useCallback(async (): Promise<MailOperationResult> => {
      const error =
        "The message identity is incomplete or has changed. Refresh the mailbox and try again.";
      if (mounted.current) {
        appMessage(error, "error");
        await current.current.inbox.refreshMessages().catch(() => {});
      }
      return { success: false, requiresRefresh: true, error };
    }, []);

  const refreshFolderCounts = useCallback(() => {
    if (mounted.current)
      void current.current.inbox.refreshCurrentFolders().catch(() => {});
  }, []);

  const captureRemoval = useCallback(
    (ids: string[]) => ({
      scope: JSON.stringify([
        current.current.inboxState.selectedAccountId,
        current.current.inbox.selectedFolder,
      ]),
      selectedId: getMessageIdentityKey(
        current.current.inboxState.selectedMessage,
      ),
      nextId: getMessageIdentityKey(
        nextVisibleMessageAfterRemoval(
          current.current.inboxState.messages.filter(
            (message) => getMessageIdentityKey(message) !== "",
          ),
          ids,
        ),
      ),
    }),
    [],
  );

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
      const ids = snapshotMessageIds(messageIds);
      if (!ids) return identityFailure();
      try {
        let result: MailOperationResult;
        if (ids.length === 1) {
          const r = await serviceMessageOps.markAsRead(ids[0]!);
          result = {
            success: r.success,
            error: r.error,
            requiresRefresh: r.requiresRefresh,
          };
        } else {
          const r = await serviceMessageOps.batchMarkRead(ids);
          result = {
            success: r.success,
            requiresRefresh: r.requiresRefresh,
            error:
              r.error ||
              (r.failedIds.length > 0
                ? `${r.failedIds.length} operations failed`
                : undefined),
          };
        }
        return result;
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to mark as read",
        };
      }
    },
    [serviceMessageOps, identityFailure],
  );

  const markAsUnread = useCallback(
    async (messageIds: string[]): Promise<MailOperationResult> => {
      const ids = snapshotMessageIds(messageIds);
      if (!ids) return identityFailure();
      try {
        if (ids.length === 1) {
          const result = await serviceMessageOps.markAsUnread(ids[0]!);
          return {
            success: result.success,
            error: result.error,
            requiresRefresh: result.requiresRefresh,
          };
        } else {
          const result = await serviceMessageOps.batchMarkUnread(ids);
          return {
            success: result.success,
            requiresRefresh: result.requiresRefresh,
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
    [serviceMessageOps, identityFailure],
  );

  const toggleRead = useCallback(
    async (message: EmailMessage): Promise<MailOperationResult> => {
      const identity = getMessageIdentityKey(message);
      if (!identity) return identityFailure();
      try {
        const isRead = message.read || message.is_read;
        const result = isRead
          ? await serviceMessageOps.markAsUnread(identity)
          : await serviceMessageOps.markAsRead(identity);
        return {
          success: result.success,
          error: result.error,
          requiresRefresh: result.requiresRefresh,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to toggle read",
        };
      }
    },
    [serviceMessageOps, identityFailure],
  );

  const moveToFolder = useCallback(
    async (
      messageIds: string[],
      targetFolder: MutationTarget,
    ): Promise<MailOperationResult> => {
      const ids = snapshotMessageIds(messageIds);
      if (!ids) return identityFailure();
      const destination =
        typeof targetFolder === "string" ? targetFolder : { ...targetFolder };
      try {
        let result: MailOperationResult;
        // Count adjustments follow the messages that actually moved. A partial
        // failure previously adjusted NOTHING, drifting every badge.
        let movedCount = 0;
        if (ids.length === 1) {
          const r = await serviceMessageOps.moveMessage(ids[0]!, destination);
          result = {
            success: r.success,
            error: r.error,
            requiresRefresh: r.requiresRefresh,
          };
          movedCount = r.success ? 1 : 0;
        } else {
          const r = await serviceMessageOps.batchMove(ids, destination);
          result = {
            success: r.success,
            requiresRefresh: r.requiresRefresh,
            error:
              r.error ||
              (r.failedIds.length > 0
                ? `${r.failedIds.length} operations failed`
                : undefined),
          };
          movedCount = r.successCount ?? 0;
        }
        if (movedCount > 0) refreshFolderCounts();
        return result;
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to move messages",
        };
      }
    },
    [serviceMessageOps, refreshFolderCounts, identityFailure],
  );

  const applyAfterRemoval = useCallback(
    (
      action: "message_list" | "next_message",
      ids: string[],
      source: ReturnType<typeof captureRemoval>,
    ) => {
      const live = current.current;
      const liveSelectedId = getMessageIdentityKey(
        live.inboxState.selectedMessage,
      );
      if (
        !mounted.current ||
        !source.selectedId ||
        !ids.includes(source.selectedId) ||
        source.scope !==
          JSON.stringify([
            live.inboxState.selectedAccountId,
            live.inbox.selectedFolder,
          ]) ||
        (liveSelectedId && liveSelectedId !== source.selectedId)
      )
        return;
      if (action === "next_message") {
        const next = live.inboxState.messages.find(
          (message) => getMessageIdentityKey(message) === source.nextId,
        );
        if (next) {
          void live.inbox.selectMessage(next);
          return;
        }
      }
      live.inbox.clearSelection();
    },
    [],
  );

  const archiveMessages = useCallback(
    async (messageIds: string[]): Promise<MailOperationResult> => {
      const ids = snapshotMessageIds(messageIds);
      if (!ids) return identityFailure();
      const source = captureRemoval(ids);
      try {
        const results = await Promise.allSettled(
          ids.map((id) => serviceMessageOps.archiveMessage(id)),
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
        if (
          results.some(
            (result) => result.status === "fulfilled" && result.value.success,
          )
        )
          refreshFolderCounts();
        if (success) {
          applyAfterRemoval(
            getUserPreferencesSnapshot().after_archive_action,
            ids,
            source,
          );
        }

        return {
          success,
          requiresRefresh: results.some(
            (result) =>
              result.status === "fulfilled" && result.value.requiresRefresh,
          ),
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
    [
      serviceMessageOps,
      applyAfterRemoval,
      captureRemoval,
      identityFailure,
      refreshFolderCounts,
    ],
  );

  const deleteMessages = useCallback(
    async (messageIds: string[]): Promise<MailOperationResult> => {
      const ids = snapshotMessageIds(messageIds);
      if (!ids) return identityFailure();
      const source = captureRemoval(ids);
      try {
        if (getUserPreferencesSnapshot().confirm_delete) {
          const confirmed = window.confirm(
            __("Delete the selected email?", "pressedmail"),
          );
          if (!confirmed) {
            return { success: false };
          }
        }
        if (ids.length === 1) {
          const result = await serviceMessageOps.deleteMessage(ids[0]!);
          if (result.success) {
            refreshFolderCounts();
            applyAfterRemoval(
              getUserPreferencesSnapshot().after_delete_action,
              ids,
              source,
            );
          }
          return {
            success: result.success,
            error: result.error,
            requiresRefresh: result.requiresRefresh,
          };
        } else {
          const result = await serviceMessageOps.batchDelete(ids);
          if (result.successCount > 0) refreshFolderCounts();
          if (result.success) {
            applyAfterRemoval(
              getUserPreferencesSnapshot().after_delete_action,
              ids,
              source,
            );
          }
          return {
            success: result.success,
            requiresRefresh: result.requiresRefresh,
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
    [
      serviceMessageOps,
      applyAfterRemoval,
      captureRemoval,
      identityFailure,
      refreshFolderCounts,
    ],
  );

  const toggleStar = useCallback(
    async (message: EmailMessage): Promise<MailOperationResult> => {
      const identity = getMessageIdentityKey(message);
      if (!identity) return identityFailure();
      try {
        const result = await serviceMessageOps.toggleStar(identity);
        return {
          success: result.success,
          error: result.error,
          requiresRefresh: result.requiresRefresh,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to toggle star",
        };
      }
    },
    [serviceMessageOps, identityFailure],
  );

  const toggleImportant = useCallback(
    async (message: EmailMessage): Promise<MailOperationResult> => {
      const identity = getMessageIdentityKey(message);
      if (!identity) return identityFailure();
      try {
        const result = await serviceMessageOps.toggleImportant(identity);
        return {
          success: result.success,
          error: result.error,
          requiresRefresh: result.requiresRefresh,
        };
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error ? err.message : "Failed to toggle importance",
        };
      }
    },
    [serviceMessageOps, identityFailure],
  );

  // ============== Compose Operations (via ComposerContext) ==============

  const startCompose = useCallback(
    (mode: ComposeMode, message?: EmailMessage) => {
      if (mode === "new") {
        composer.setComposeData({ ...DEFAULT_COMPOSE_DATA });
        return;
      }

      if (!message) return;
      const ref = getMessageIdentityRef(message);
      if (!ref) {
        void identityFailure();
        return;
      }

      const sourceAccount = accounts.find(
        (account) => String(account.id) === String(ref.accountId),
      );
      if (!sourceAccount?.email) {
        void identityFailure();
        return;
      }

      const newComposeData: ComposeData & { is_reply?: boolean } = {
        ...DEFAULT_COMPOSE_DATA,
        mode: mode === "replyAll" ? "reply-all" : mode,
        fromAccount: sourceAccount.email,
      };

      if (mode === "reply" || mode === "replyAll") {
        newComposeData.to = message.from || "";
        newComposeData.subject = message.subject?.startsWith("Re:")
          ? message.subject
          : `Re: ${message.subject}`;
        newComposeData.is_reply = true;
        newComposeData.inReplyTo = message.messageId ?? message.message_id;
        newComposeData.references = message.references;
        newComposeData.replySource = {
          identity: getMessageIdentityKey(message),
          accountId: ref.accountId,
          folder: ref.folder,
          uid: ref.uid,
        };
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
    [accounts, composer, identityFailure],
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
