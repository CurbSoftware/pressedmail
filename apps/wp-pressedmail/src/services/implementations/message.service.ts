/**
 * Message Service Implementation
 *
 * Wraps message operation API endpoints with type-safe interface.
 * Handles single and batch operations with optimistic cache updates.
 *
 * @since 2.0.0
 */

import { __ } from "@wordpress/i18n";

import type { EmailMessage } from "@/types";
import type {
  IMessageOperations,
  GetMessageOptions,
  OperationResult,
  BatchOperationResult,
  MessageFlag,
  MessageMutationOptions,
  BatchMessageMutationOptions,
  FolderTarget,
} from "../interfaces";
import type { ICacheService } from "../interfaces";
import type { IConnectionStateService } from "../interfaces/connection-state.interface";
import {
  apiPost,
  apiForm,
  type ApiResponse,
  type ApiErrorResponse,
} from "@/lib/api-client";
import {
  markEmailAsReadRouteApi,
  markEmailAsUnreadRouteApi,
  batchMarkReadRouteApi,
  batchMarkUnreadRouteApi,
  batchDeleteRouteApi,
  batchMoveRouteApi,
  emptyTrashRouteApi,
  deleteEmailFromImapRouteApi,
  moveEmailRouteApi,
  flagEmailRouteApi,
  messageRawHeadersRouteApi,
  messageDetailRouteApi,
  buildApiUrl,
} from "@/context/Strings";
import { getMailboxSourceRequestParams } from "@/lib/mailbox-source";
import { isDestinationMutationTarget } from "@/lib/folder-destination";
import type { MutationTarget } from "@/lib/folder-target";
import {
  getMessageIdentityKey,
  parseAccountQualifiedToken,
  parseMessageIdentityRef,
  type MessageIdentityRef,
} from "@/lib/message-identity";

/**
 * A function rather than a constant: a module-level constant is evaluated on
 * first import, which can land before `i18n-boot` applies the user's catalog,
 * freezing the English string in for the session.
 */
function identityConflictMessage(): string {
  return __(
    "The mailbox reference is incomplete or has changed. Refresh the mailbox and try again.",
    "pressedmail",
  );
}
const IDENTITY_CONFLICT_CODES = new Set([
  "mailbox_generation_unavailable",
  "mailbox_generation_changed",
  "message_identity_conflict",
  "uid_validity_changed",
]);

type IdentityOptions = Pick<
  MessageMutationOptions,
  "folder" | "uidValidity" | "identifierMode"
>;

function resolveIdentity(
  accountId: string | number,
  messageId: string | number,
  options?: IdentityOptions,
): MessageIdentityRef | null {
  if (options?.identifierMode !== undefined && options.identifierMode !== "uid")
    return null;
  const parsed = parseAccountQualifiedToken(String(messageId));
  if (parsed && parsed.kind !== "message") return null;
  const ref = parseMessageIdentityRef({
    accountId,
    uid: parsed?.uid ?? messageId,
    folder: options?.folder !== undefined ? options.folder : parsed?.folder,
    uidValidity:
      options?.uidValidity !== undefined
        ? options.uidValidity
        : parsed?.uidValidity,
  });
  if (!ref || (parsed && identityToken(ref) !== identityToken(parsed)))
    return null;
  return ref;
}

function identityToken(ref: MessageIdentityRef): string {
  return getMessageIdentityKey({ ...ref, id: ref.uid } as EmailMessage);
}

function requiresIdentityRefresh(response: unknown): boolean {
  const error = response as { code?: string; data?: { code?: string } } | null;
  return (
    IDENTITY_CONFLICT_CODES.has(error?.code ?? "") ||
    IDENTITY_CONFLICT_CODES.has(error?.data?.code ?? "")
  );
}

function operationFailure(response: ApiErrorResponse | Error): OperationResult {
  return {
    success: false,
    error: getErrorMessage(response),
    ...(requiresIdentityRefresh(response) ? { requiresRefresh: true } : {}),
  };
}

function identityFailure(): OperationResult {
  return {
    success: false,
    error: identityConflictMessage(),
    requiresRefresh: true,
  };
}

/**
 * Check if response is an error.
 */
function isError(
  response: ApiResponse | ApiErrorResponse | Error,
): response is ApiErrorResponse | Error {
  if (response instanceof Error) return true;
  if (!("status" in response)) return false;
  const status = (response as { status: unknown }).status;
  // PHP REST endpoints answer HTTP 200 with a string status envelope
  // ({ status: 'error' | 'success', ... }); transport failures surface a numeric
  // HTTP status. Treat both shapes as errors so optimistic updates revert.
  if (typeof status === "string") return status === "error";
  return typeof status === "number" && (status >= 400 || status === 505);
}

/**
 * Extract error message from response.
 */
function getErrorMessage(response: ApiErrorResponse | Error): string {
  if (response instanceof Error) {
    return response.message;
  }
  if (typeof response.message === "string") {
    return response.message;
  }
  if (
    typeof response.data === "object" &&
    response.data !== null &&
    "message" in response.data &&
    typeof response.data.message === "string"
  ) {
    return response.data.message;
  }
  return __("Something went wrong. Please try again.", "pressedmail");
}

function mutationWarning(response: unknown): string | undefined {
  const warning = (response as { warning?: unknown } | null)?.warning;
  return typeof warning === "string" && warning ? warning : undefined;
}

interface BatchMutationResponse {
  status?: string | number;
  message?: string;
  processed_count?: number;
  failed_ids?: unknown;
  total_count?: number;
  warning?: string | null;
}

/**
 * Message Service Implementation
 *
 * Implements IMessageOperations for message CRUD and batch operations.
 */
export class MessageService implements IMessageOperations {
  private cache: ICacheService | null;
  private connectionState: IConnectionStateService | null;

  constructor(
    cache?: ICacheService,
    connectionState?: IConnectionStateService,
  ) {
    this.cache = cache ?? null;
    this.connectionState = connectionState ?? null;
  }

  /**
   * Wrap an operation with circuit breaker if available.
   */
  private async withBreaker<T>(
    accountId: string | number,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (this.connectionState) {
      return this.connectionState.withCircuitBreaker(
        String(accountId),
        operation,
      );
    }
    return operation();
  }

  private buildMessageMutationPayload(
    ref: MessageIdentityRef,
  ): Record<string, string | number> {
    return {
      account_id: ref.accountId,
      folder: ref.folder,
      uid: ref.uid,
      uid_validity: ref.uidValidity,
    };
  }

  private resolveBatchIdentity(
    accountId: string | number,
    messageIds: (string | number)[],
    options?: BatchMessageMutationOptions,
  ): MessageIdentityRef[] | null {
    const refs = messageIds.map((id) =>
      resolveIdentity(accountId, id, options),
    );
    if (refs.some((ref) => !ref)) return null;
    const first = refs[0];
    if (
      refs.some(
        (ref) =>
          ref?.folder !== first?.folder ||
          ref?.uidValidity !== first?.uidValidity,
      )
    )
      return null;
    const complete = refs as MessageIdentityRef[];
    return new Set(complete.map(identityToken)).size === complete.length
      ? complete
      : null;
  }

  private buildBatchMutationPayload(
    refs: MessageIdentityRef[],
  ): Record<string, string | number | boolean | string[]> {
    const first = refs[0]!;
    return {
      account_id: first.accountId,
      folder: first.folder,
      uid_validity: first.uidValidity,
      message_ids: refs.map((ref) => ref.uid),
      is_uid: true,
    };
  }

  private createBatchFailureResult(
    messageIds: (string | number)[],
    error: string,
  ): BatchOperationResult {
    return {
      success: false,
      error,
      successCount: 0,
      failedIds: messageIds,
      totalCount: messageIds.length,
    };
  }

  private parseBatchResponse(
    response: ApiResponse,
    messageIds: (string | number)[],
  ): BatchOperationResult {
    const batchResponse = response as BatchMutationResponse;

    if (
      batchResponse.failed_ids !== undefined &&
      !Array.isArray(batchResponse.failed_ids)
    ) {
      return this.createBatchFailureResult(
        messageIds,
        "Invalid batch mailbox response: failed_ids must be an array",
      );
    }

    const failedIds = Array.isArray(batchResponse.failed_ids)
      ? batchResponse.failed_ids.filter(
          (identifier): identifier is string | number =>
            typeof identifier === "string" || typeof identifier === "number",
        )
      : [];

    if (
      Array.isArray(batchResponse.failed_ids) &&
      failedIds.length !== batchResponse.failed_ids.length
    ) {
      return this.createBatchFailureResult(
        messageIds,
        "Invalid batch mailbox response: failed_ids must contain only message identifiers",
      );
    }

    const requestedIds = new Set(messageIds.map(String));
    if (
      failedIds.some((id) => !requestedIds.has(String(id))) ||
      new Set(failedIds.map(String)).size !== failedIds.length
    ) {
      return this.createBatchFailureResult(
        messageIds,
        "Invalid batch mailbox response: failed_ids must identify distinct requested messages",
      );
    }

    if (
      batchResponse.processed_count !== undefined &&
      typeof batchResponse.processed_count !== "number"
    ) {
      return this.createBatchFailureResult(
        messageIds,
        "Invalid batch mailbox response: processed_count must be a number",
      );
    }

    const processedCount =
      typeof batchResponse.processed_count === "number"
        ? batchResponse.processed_count
        : Math.max(0, messageIds.length - failedIds.length);

    if (
      !Number.isInteger(processedCount) ||
      processedCount < 0 ||
      processedCount > messageIds.length
    ) {
      return this.createBatchFailureResult(
        messageIds,
        "Invalid batch mailbox response: processed_count is out of range",
      );
    }

    if (processedCount + failedIds.length !== messageIds.length) {
      return this.createBatchFailureResult(
        messageIds,
        "Invalid batch mailbox response: processed_count and failed_ids do not match the requested total",
      );
    }

    const resolvedFailedIds =
      failedIds.length > 0
        ? failedIds
        : processedCount === messageIds.length
          ? []
          : messageIds;
    const success = resolvedFailedIds.length === 0;

    const rawCreated = (batchResponse as { created_folders?: unknown })
      .created_folders;
    const createdFolders = Array.isArray(rawCreated)
      ? rawCreated
          .filter(
            (entry): entry is { path?: unknown; folder_id?: unknown } =>
              typeof entry === "object" && entry !== null,
          )
          .map((entry) => ({
            path: String(entry.path ?? ""),
            folderId:
              typeof entry.folder_id === "number" ? entry.folder_id : null,
          }))
          .filter((entry) => entry.path !== "")
      : [];

    return {
      success,
      successCount: processedCount,
      failedIds: resolvedFailedIds,
      totalCount: messageIds.length,
      ...(typeof batchResponse.warning === "string" && batchResponse.warning
        ? { warning: batchResponse.warning }
        : {}),
      ...(createdFolders.length > 0 ? { createdFolders } : {}),
      error: success
        ? undefined
        : `Failed to process ${resolvedFailedIds.length} of ${messageIds.length} messages`,
    };
  }

  /** Max message IDs sent per batch request: keeps each live-IMAP mutation request
   * comfortably under the gateway timeout. Larger selections are chunked sequentially so
   * the whole operation completes without a single unbounded (504-prone) request. */
  private static readonly BATCH_CHUNK_SIZE = 100;

  private async executeBatchRequest(
    accountId: string | number,
    route: string,
    messageIds: (string | number)[],
    options?: BatchMessageMutationOptions,
    extraPayload?: Record<string, unknown>,
  ): Promise<BatchOperationResult> {
    messageIds = [...messageIds];
    const capturedRefs = this.resolveBatchIdentity(
      accountId,
      messageIds,
      options,
    );
    if (!capturedRefs) {
      return {
        ...this.createBatchFailureResult(messageIds, identityConflictMessage()),
        requiresRefresh: true,
      };
    }
    const first = capturedRefs[0];
    options = first
      ? {
          folder: first.folder,
          uidValidity: first.uidValidity,
          identifierMode: "uid",
        }
      : undefined;
    const chunkSize = MessageService.BATCH_CHUNK_SIZE;
    if (messageIds.length <= chunkSize) {
      return this.executeBatchChunk(
        accountId,
        route,
        messageIds,
        options,
        extraPayload,
      );
    }

    // Large selection → send in bounded chunks and aggregate, so a multi-thousand
    // delete/move can't blow the gateway timeout in one request and never silently
    // drops the overflow the server would otherwise leave as `remaining`.
    const aggregate: BatchOperationResult = {
      success: true,
      successCount: 0,
      failedIds: [],
      totalCount: messageIds.length,
    };
    for (let i = 0; i < messageIds.length; i += chunkSize) {
      const chunkIds = messageIds.slice(i, i + chunkSize);
      const result = await this.executeBatchChunk(
        accountId,
        route,
        chunkIds,
        options,
        extraPayload,
      );
      aggregate.successCount =
        (aggregate.successCount ?? 0) + (result.successCount ?? 0);
      if (result.failedIds?.length) {
        aggregate.failedIds = [
          ...(aggregate.failedIds ?? []),
          ...result.failedIds,
        ];
      }
      if (result.createdFolders?.length) {
        aggregate.createdFolders = [
          ...(aggregate.createdFolders ?? []),
          ...result.createdFolders,
        ];
      }
      if (result.rateLimited) {
        aggregate.rateLimited = true;
      }
      if (result.warning) aggregate.warning ??= result.warning;
      if (result.requiresRefresh) aggregate.requiresRefresh = true;
      if (!result.success) {
        const unattemptedIds = messageIds.slice(i + chunkIds.length);
        if (unattemptedIds.length > 0) {
          aggregate.failedIds = [
            ...(aggregate.failedIds ?? []),
            ...unattemptedIds,
          ];
        }
        aggregate.success = false;
        aggregate.error ??= result.error;
        break;
      }
    }
    return aggregate;
  }

  /** Longest wait honoured for a 429 before giving up on the chunk. */
  private static readonly MAX_RETRY_AFTER_SECONDS = 70;
  /** Retries per chunk after a throttled response. */
  private static readonly RATE_LIMIT_RETRIES = 2;

  private static delay(seconds: number): Promise<void> {
    return new Promise((resolve) =>
      globalThis.setTimeout(resolve, Math.max(0, seconds) * 1000),
    );
  }

  /**
   * Retry-after seconds from a throttled envelope, or null when not throttled.
   */
  private static retryAfterSeconds(response: unknown): number | null {
    const envelope = response as
      | { status?: number | string; retry_after?: number }
      | undefined;
    const status = Number(envelope?.status);
    if (status !== 429) return null;
    const retryAfter = Number(envelope?.retry_after);
    return Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter, MessageService.MAX_RETRY_AFTER_SECONDS)
      : 1;
  }

  private async executeBatchChunk(
    accountId: string | number,
    route: string,
    messageIds: (string | number)[],
    options?: BatchMessageMutationOptions,
    extraPayload?: Record<string, unknown>,
    attempt = 0,
  ): Promise<BatchOperationResult> {
    if (messageIds.length === 0) {
      return {
        success: true,
        successCount: 0,
        failedIds: [],
        totalCount: 0,
      };
    }

    const refs = this.resolveBatchIdentity(accountId, messageIds, options);
    if (!refs)
      return {
        ...this.createBatchFailureResult(messageIds, identityConflictMessage()),
        requiresRefresh: true,
      };
    try {
      const response = await this.withBreaker(accountId, () =>
        apiForm(route, {
          ...this.buildBatchMutationPayload(refs),
          ...extraPayload,
        }),
      );

      if (isError(response)) {
        // A throttled chunk is not a failed chunk: wait out the server's
        // retry_after and try again, rather than abandoning the rest of a
        // sweep the user asked for.
        const retryAfter = MessageService.retryAfterSeconds(response);
        if (
          retryAfter !== null &&
          attempt < MessageService.RATE_LIMIT_RETRIES
        ) {
          await MessageService.delay(retryAfter);
          const retried = await this.executeBatchChunk(
            accountId,
            route,
            messageIds,
            options,
            extraPayload,
            attempt + 1,
          );
          return { ...retried, rateLimited: true };
        }

        return {
          ...this.createBatchFailureResult(
            messageIds,
            getErrorMessage(response as ApiErrorResponse),
          ),
          ...(retryAfter !== null ? { rateLimited: true } : {}),
          ...(requiresIdentityRefresh(response)
            ? { requiresRefresh: true }
            : {}),
        };
      }

      const result = this.parseBatchResponse(
        response,
        refs.map((ref) => ref.uid),
      );
      const originalIds = new Map(
        refs.map((ref, index) => [ref.uid, messageIds[index]!]),
      );
      return {
        ...result,
        failedIds: result.failedIds.map((id) => originalIds.get(String(id))!),
      };
    } catch (error) {
      return this.createBatchFailureResult(
        messageIds,
        error instanceof Error
          ? error.message
          : "Batch mailbox operation failed",
      );
    }
  }

  // ============== Single Message Operations ==============

  async getMessage(
    accountId: string | number,
    messageId: string | number,
    options?: GetMessageOptions,
  ): Promise<EmailMessage | null> {
    const ref = resolveIdentity(accountId, messageId, options);
    if (!ref) return null;
    const token = identityToken(ref);
    const folder = ref.folder;
    // Check cache first (unless forcing refresh)
    if (!options?.forceRefresh && this.cache) {
      const cached = this.cache.getMessageDetail(
        String(accountId),
        folder,
        token,
      );
      if (
        cached &&
        getMessageIdentityKey(cached) === token &&
        (cached.htmlBody || cached.textBody || !options?.includeBody)
      ) {
        return cached;
      }
    }

    try {
      const url = buildApiUrl(`${messageDetailRouteApi}${accountId}`, {
        uid: ref.uid,
        uid_validity: ref.uidValidity,
        folder,
        ...getMailboxSourceRequestParams(),
      });

      const response = await apiPost<EmailMessage>(url, {
        ...this.buildMessageMutationPayload(ref),
        ...getMailboxSourceRequestParams(),
      });

      if (isError(response)) {
        console.error(
          "[MessageService] Failed to get message detail:",
          response,
        );
        return null;
      }

      const message = (response as ApiResponse<EmailMessage>).data ?? null;
      if (!message || getMessageIdentityKey(message) !== token) return null;

      // Cache the detail
      if (message && this.cache) {
        this.cache.setMessageDetail(String(accountId), ref.folder, message);
      }

      return message;
    } catch (error) {
      console.error("[MessageService] getMessage error:", error);
      return null;
    }
  }

  async markAsRead(
    accountId: string | number,
    messageId: string | number,
    options?: MessageMutationOptions,
  ): Promise<OperationResult> {
    const ref = resolveIdentity(accountId, messageId, options);
    if (!ref) return identityFailure();
    try {
      const response = await this.withBreaker(accountId, () =>
        apiForm(markEmailAsReadRouteApi, this.buildMessageMutationPayload(ref)),
      );
      if (isError(response))
        return operationFailure(response as ApiErrorResponse);
      // The caller owns optimistic UI. A failed request must not overwrite a
      // newer confirmed cache value with an assumed opposite flag.
      this.cache?.updateMessage(
        String(ref.accountId),
        identityToken(ref),
        { read: true },
        ref.folder,
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : __("Failed to mark as read", "pressedmail"),
      };
    }
  }

  async markAsUnread(
    accountId: string | number,
    messageId: string | number,
    options?: MessageMutationOptions,
  ): Promise<OperationResult> {
    const ref = resolveIdentity(accountId, messageId, options);
    if (!ref) return identityFailure();
    try {
      const response = await this.withBreaker(accountId, () =>
        apiForm(
          markEmailAsUnreadRouteApi,
          this.buildMessageMutationPayload(ref),
        ),
      );
      if (isError(response))
        return operationFailure(response as ApiErrorResponse);
      // The caller owns optimistic UI. A failed request must not overwrite a
      // newer confirmed cache value with an assumed opposite flag.
      this.cache?.updateMessage(
        String(ref.accountId),
        identityToken(ref),
        { read: false },
        ref.folder,
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : __("Failed to mark as unread", "pressedmail"),
      };
    }
  }

  async toggleStar(
    accountId: string | number,
    messageId: string | number,
    options?: MessageMutationOptions,
  ): Promise<OperationResult> {
    const ref = resolveIdentity(accountId, messageId, options);
    if (!ref) return identityFailure();
    const token = identityToken(ref);
    try {
      const response = await this.withBreaker(accountId, () =>
        apiForm(flagEmailRouteApi, {
          ...this.buildMessageMutationPayload(ref),
          flag: "\\Flagged",
          action: "toggle",
        }),
      );

      if (isError(response)) {
        return operationFailure(response as ApiErrorResponse);
      }

      // Get the new starred state from response if available
      const data = (response as ApiResponse).data;
      const newStarred = data?.starred ?? data?.flagged;

      // Update cache with new state
      if (this.cache && newStarred !== undefined) {
        this.cache.updateMessage(
          String(accountId),
          token,
          {
            starred: newStarred,
          },
          ref.folder,
        );
      }

      return {
        success: true,
        message: data,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : __("Failed to toggle star", "pressedmail"),
      };
    }
  }

  async getRawHeaders(
    accountId: string | number,
    messageId: string | number,
    options?: MessageMutationOptions,
  ): Promise<OperationResult & { headers?: string }> {
    const ref = resolveIdentity(accountId, messageId, options);
    if (!ref) return identityFailure();
    try {
      const response = await this.withBreaker(accountId, () =>
        apiForm(
          messageRawHeadersRouteApi,
          this.buildMessageMutationPayload(ref),
        ),
      );

      if (isError(response)) {
        return operationFailure(response as ApiErrorResponse);
      }

      const data = (response as ApiResponse).data as
        | { raw_headers?: unknown }
        | undefined;
      const headers =
        typeof data?.raw_headers === "string" ? data.raw_headers : "";

      return { success: true, headers };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : __("Failed to fetch headers", "pressedmail"),
      };
    }
  }

  async deleteMessage(
    accountId: string | number,
    messageId: string | number,
    permanent = false,
    options?: MessageMutationOptions,
  ): Promise<OperationResult> {
    const ref = resolveIdentity(accountId, messageId, options);
    if (!ref) return identityFailure();
    const token = identityToken(ref);
    const folder = ref.folder;

    // Optimistic removal from cache
    if (this.cache) {
      this.cache.removeMessage(String(ref.accountId), token);
    }

    try {
      const response = await this.withBreaker(accountId, () =>
        apiForm(deleteEmailFromImapRouteApi, {
          ...this.buildMessageMutationPayload(ref),
          permanent: permanent ? 1 : 0,
        }),
      );

      if (isError(response)) {
        // Rollback: would need to re-fetch or restore from backup
        // For now, just invalidate cache to force refresh
        if (this.cache) {
          this.cache.invalidateMessages({
            accountId: String(accountId),
            folder,
          });
        }
        return operationFailure(response as ApiErrorResponse);
      }

      return { success: true, warning: mutationWarning(response) };
    } catch (error) {
      // Invalidate cache on error
      if (this.cache) {
        this.cache.invalidateMessages({
          accountId: String(accountId),
          folder,
        });
      }
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : __("Failed to delete message", "pressedmail"),
      };
    }
  }

  async moveMessage(
    accountId: string | number,
    messageId: string | number,
    targetFolder: string | FolderTarget,
    options?: MessageMutationOptions,
  ): Promise<OperationResult> {
    const ref = resolveIdentity(accountId, messageId, options);
    if (!ref) return identityFailure();
    if (
      typeof targetFolder !== "string" &&
      targetFolder.accountId !== ref.accountId
    ) {
      return identityFailure();
    }
    const token = identityToken(ref);
    const sourceFolder = ref.folder;
    const targetPath =
      typeof targetFolder === "string" ? targetFolder : targetFolder.path;

    // Optimistic removal from current folder cache
    if (this.cache) {
      this.cache.removeMessage(String(ref.accountId), token);
    }

    try {
      const response = await this.withBreaker(accountId, () =>
        apiForm(moveEmailRouteApi, {
          ...this.buildMessageMutationPayload(ref),
          target_folder: targetPath,
          ...(typeof targetFolder === "string" || targetFolder.folderId === null
            ? {}
            : {
                target_account_id: targetFolder.accountId,
                target_folder_id: targetFolder.folderId,
              }),
        }),
      );

      if (isError(response)) {
        // Invalidate to force refresh
        if (this.cache) {
          this.cache.invalidateMessages({
            accountId: String(accountId),
            folder: sourceFolder,
          });
        }
        return operationFailure(response as ApiErrorResponse);
      }

      // Invalidate target folder cache too
      if (this.cache) {
        this.cache.invalidateMessages({
          accountId: String(accountId),
          folder: sourceFolder,
        });
        this.cache.invalidateMessages({
          accountId: String(ref.accountId),
          folder: targetPath,
        });
      }

      return { success: true, warning: mutationWarning(response) };
    } catch (error) {
      if (this.cache) {
        this.cache.invalidateMessages({
          accountId: String(accountId),
          folder: sourceFolder,
        });
      }
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : __("Failed to move message", "pressedmail"),
      };
    }
  }

  async archiveMessage(
    accountId: string | number,
    messageId: string | number,
    options?: MessageMutationOptions,
  ): Promise<OperationResult> {
    // Archive is just a move to Archive folder
    return this.moveMessage(accountId, messageId, "Archive", options);
  }

  async setFlag(
    accountId: string | number,
    messageId: string | number,
    flag: MessageFlag,
    value: boolean,
    options?: MessageMutationOptions,
  ): Promise<OperationResult> {
    const ref = resolveIdentity(accountId, messageId, options);
    if (!ref) return identityFailure();
    const token = identityToken(ref);
    try {
      const response = await this.withBreaker(accountId, () =>
        apiForm(flagEmailRouteApi, {
          ...this.buildMessageMutationPayload(ref),
          flag,
          action: value ? "add" : "remove",
        }),
      );

      if (isError(response)) {
        return operationFailure(response as ApiErrorResponse);
      }

      // Update cache based on flag
      if (this.cache) {
        const updates: Partial<EmailMessage> = {};
        switch (flag) {
          case "\\Seen":
            updates.read = value;
            break;
          case "\\Flagged":
            updates.starred = value;
            break;
          // Other flags don't have direct EmailMessage mappings
        }
        if (Object.keys(updates).length > 0) {
          this.cache.updateMessage(
            String(accountId),
            token,
            updates,
            ref.folder,
          );
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : __("Failed to set flag", "pressedmail"),
      };
    }
  }

  // ============== Batch Operations ==============

  async batchMarkRead(
    accountId: string | number,
    messageIds: (string | number)[],
    options?: BatchMessageMutationOptions,
  ): Promise<BatchOperationResult> {
    return this.executeBatchRequest(
      accountId,
      batchMarkReadRouteApi,
      messageIds,
      options,
    );
  }

  async batchMarkUnread(
    accountId: string | number,
    messageIds: (string | number)[],
    options?: BatchMessageMutationOptions,
  ): Promise<BatchOperationResult> {
    return this.executeBatchRequest(
      accountId,
      batchMarkUnreadRouteApi,
      messageIds,
      options,
    );
  }

  async batchDelete(
    accountId: string | number,
    messageIds: (string | number)[],
    permanent = false,
    options?: BatchMessageMutationOptions,
  ): Promise<BatchOperationResult> {
    return this.executeBatchRequest(
      accountId,
      batchDeleteRouteApi,
      messageIds,
      options,
      {
        expunge: true,
        permanent: permanent ? 1 : 0,
      },
    );
  }

  async batchMove(
    accountId: string | number,
    messageIds: (string | number)[],
    targetFolder: MutationTarget,
    options?: BatchMessageMutationOptions,
  ): Promise<BatchOperationResult> {
    // Cross-account destination union: the server resolves, and, behind the
    // explicit opt-in, creates, the folder per account. The batch endpoints
    // are form-encoded, so the union MUST travel as a JSON string, a raw
    // object toString()s into "[object Object]" inside FormData.
    if (isDestinationMutationTarget(targetFolder)) {
      return this.executeBatchRequest(
        accountId,
        batchMoveRouteApi,
        messageIds,
        options,
        {
          target_destination: JSON.stringify(targetFolder.destination),
          create_missing_target: 1,
        },
      );
    }

    if (
      typeof targetFolder !== "string" &&
      targetFolder.accountId !== Number(accountId)
    ) {
      return {
        ...this.createBatchFailureResult(messageIds, identityConflictMessage()),
        requiresRefresh: true,
      };
    }

    return this.executeBatchRequest(
      accountId,
      batchMoveRouteApi,
      messageIds,
      options,
      {
        target_folder:
          typeof targetFolder === "string" ? targetFolder : targetFolder.path,
        ...(typeof targetFolder === "string" || targetFolder.folderId === null
          ? {}
          : {
              target_account_id: targetFolder.accountId,
              target_folder_id: targetFolder.folderId,
            }),
      },
    );
  }

  async emptyTrash(
    accountId: string | number,
    folder = "Trash",
  ): Promise<BatchOperationResult> {
    // The server empties Trash in bounded batches (capped per request to stay under the
    // gateway timeout) and reports `remaining`. Keep calling until it's drained, or a
    // safety cap, then report partial progress so the user can retry.
    const MAX_PASSES = 50;
    const aggregate: BatchOperationResult = {
      success: true,
      successCount: 0,
      failedIds: [],
      totalCount: 0,
    };

    for (let pass = 0; pass < MAX_PASSES; pass++) {
      const { result, remaining } = await this.emptyTrashChunk(
        accountId,
        folder,
      );
      aggregate.successCount =
        (aggregate.successCount ?? 0) + (result.successCount ?? 0);
      aggregate.totalCount =
        (aggregate.totalCount ?? 0) + (result.totalCount ?? 0);
      if (result.failedIds?.length) {
        aggregate.failedIds = [
          ...(aggregate.failedIds ?? []),
          ...result.failedIds,
        ];
      }
      if (result.rateLimited) {
        aggregate.rateLimited = true;
      }
      if (!result.success) {
        aggregate.success = false;
        aggregate.error = result.error;
        return aggregate;
      }
      if (remaining <= 0) {
        return aggregate;
      }
    }

    aggregate.success = false;
    aggregate.error =
      "Trash is not empty yet. Run Empty Trash again to continue.";
    return aggregate;
  }

  private async emptyTrashChunk(
    accountId: string | number,
    folder: string,
  ): Promise<{ result: BatchOperationResult; remaining: number }> {
    try {
      const response = await this.withBreaker(accountId, () =>
        apiForm(emptyTrashRouteApi, {
          account_id: accountId,
          folder,
        }),
      );

      if (isError(response)) {
        return {
          result: {
            success: false,
            error: getErrorMessage(response as ApiErrorResponse),
            successCount: 0,
            failedIds: [],
            totalCount: 0,
          },
          remaining: 0,
        };
      }

      const payload = response as BatchMutationResponse & {
        remaining?: number;
      };
      if (
        payload.failed_ids !== undefined &&
        !Array.isArray(payload.failed_ids)
      ) {
        return {
          result: {
            success: false,
            error: "Invalid empty-trash response: failed_ids must be an array",
            successCount: 0,
            failedIds: [],
            totalCount: 0,
          },
          remaining: 0,
        };
      }

      const failedIds = Array.isArray(payload.failed_ids)
        ? payload.failed_ids.filter(
            (identifier): identifier is string | number =>
              typeof identifier === "string" || typeof identifier === "number",
          )
        : [];
      const successCount =
        typeof payload.processed_count === "number"
          ? payload.processed_count
          : 0;
      const totalCount =
        typeof payload.total_count === "number"
          ? payload.total_count
          : successCount + failedIds.length;
      const remaining =
        typeof payload.remaining === "number" && payload.remaining > 0
          ? payload.remaining
          : 0;

      return {
        result: {
          success: failedIds.length === 0,
          successCount,
          failedIds,
          totalCount,
          error:
            failedIds.length === 0
              ? undefined
              : `Failed to empty ${failedIds.length} Trash messages`,
        },
        remaining,
      };
    } catch (error) {
      return {
        result: {
          success: false,
          error: error instanceof Error ? error.message : "Empty Trash failed",
          successCount: 0,
          failedIds: [],
          totalCount: 0,
        },
        remaining: 0,
      };
    }
  }

  async batchArchive(
    accountId: string | number,
    messageIds: (string | number)[],
    options?: BatchMessageMutationOptions,
  ): Promise<BatchOperationResult> {
    return this.batchMove(accountId, messageIds, "Archive", options);
  }

  async batchToggleStar(
    accountId: string | number,
    messageIds: (string | number)[],
    starred: boolean,
    options?: BatchMessageMutationOptions,
  ): Promise<BatchOperationResult> {
    messageIds = [...messageIds];
    const refs = this.resolveBatchIdentity(accountId, messageIds, options);
    if (!refs) {
      return {
        ...this.createBatchFailureResult(messageIds, identityConflictMessage()),
        requiresRefresh: true,
      };
    }
    const first = refs[0];
    options = first
      ? {
          folder: first.folder,
          uidValidity: first.uidValidity,
          identifierMode: "uid",
        }
      : undefined;
    return this.executeBatch(messageIds, (id) =>
      this.setFlag(accountId, id, "\\Flagged", starred, options),
    );
  }

  async batchApplyLabels(
    accountId: string | number,
    messageIds: (string | number)[],
    _labels: string[],
  ): Promise<BatchOperationResult> {
    // Labels are not directly supported via IMAP flags
    // This would require custom implementation or Gmail API
    console.warn("[MessageService] batchApplyLabels not implemented for IMAP");
    return {
      success: false,
      error: "Label operations not supported for this account type",
      successCount: 0,
      failedIds: messageIds,
      totalCount: messageIds.length,
    };
  }

  async batchRemoveLabels(
    accountId: string | number,
    messageIds: (string | number)[],
    _labels: string[],
  ): Promise<BatchOperationResult> {
    console.warn("[MessageService] batchRemoveLabels not implemented for IMAP");
    return {
      success: false,
      error: "Label operations not supported for this account type",
      successCount: 0,
      failedIds: messageIds,
      totalCount: messageIds.length,
    };
  }

  // ============== Private Helpers ==============

  /**
   * Execute batch operation with parallel processing.
   */
  private async executeBatch(
    ids: (string | number)[],
    operation: (id: string | number) => Promise<OperationResult>,
  ): Promise<BatchOperationResult> {
    const results = await Promise.allSettled(ids.map((id) => operation(id)));

    const failedIds: (string | number)[] = [];
    let successCount = 0;
    let firstError: string | undefined;
    let requiresRefresh = false;

    results.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value.success) {
        successCount++;
      } else {
        if (result.status === "fulfilled" && result.value.requiresRefresh)
          requiresRefresh = true;
        failedIds.push(ids[index]!);
        const error =
          result.status === "fulfilled"
            ? result.value.error
            : result.reason instanceof Error
              ? result.reason.message
              : undefined;
        if (!firstError && error) {
          firstError = error;
        }
      }
    });

    return {
      success: failedIds.length === 0,
      successCount,
      failedIds,
      totalCount: ids.length,
      ...(requiresRefresh ? { requiresRefresh: true } : {}),
      error:
        failedIds.length > 0
          ? (firstError ??
            `Failed to process ${failedIds.length} of ${ids.length} messages`)
          : undefined,
    };
  }
}

/**
 * Singleton instance for shared message operations.
 */
let messageServiceInstance: MessageService | null = null;

/**
 * Get the shared MessageService instance.
 */
export function getMessageService(
  cache?: ICacheService,
  connectionState?: IConnectionStateService,
): MessageService {
  if (!messageServiceInstance) {
    messageServiceInstance = new MessageService(cache, connectionState);
  }
  return messageServiceInstance;
}

/**
 * Reset the message service (mainly for testing).
 */
export function resetMessageService(): void {
  messageServiceInstance = null;
}
