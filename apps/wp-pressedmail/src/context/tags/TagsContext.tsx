/**
 * Tags Context
 *
 * React context for tag management.
 *
 * @since 1.1.0
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { __ } from "@wordpress/i18n";
import type {
  Tag,
  TagCapabilities,
  TagsContextValue,
  CreateTagData,
  UpdateTagData,
  TagsResponse,
  TagOperationResponse,
  MessageIdentifier,
} from "../../types/tags";
import { routeApiPrefix, buildApiUrl } from "../Strings";
import { apiFetch, SessionExpiredError } from "@/lib/api-client";
import { parseMessageIdentityRef } from "@/lib/message-identity";
import {
  captureRequestPrincipal,
  isRequestPrincipalCurrent,
} from "@/lib/principal-storage";

const TagsContext = createContext<TagsContextValue | undefined>(undefined);

interface TagsProviderProps {
  children: React.ReactNode;
  accountId?: number;
}

/**
 * Get API base URL.
 */
const getApiUrl = (): string => routeApiPrefix;

/**
 * JSON request headers. apiFetch adds the REST nonce and same-origin
 * credentials, so nothing here overrides them.
 */
const JSON_HEADERS: HeadersInit = { "Content-Type": "application/json" };

/** Parse a JSON body without turning an HTML error page into a SyntaxError. */
async function readJson<T>(response: Response): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null;
}

/** Snapshot an explicit physical mailbox reference before starting a request. */
function requireMessageIdentifier(
  message: MessageIdentifier,
): MessageIdentifier {
  const ref = parseMessageIdentityRef({
    accountId: message?.account_id,
    uid: message?.message_uid,
    folder: message?.folder,
    uidValidity: message?.uid_validity,
  });
  if (!ref || Array.isArray(message)) {
    throw Object.assign(
      new Error(
        __(
          "Reload the mailbox before changing or loading message tags.",
          "pressedmail",
        ),
      ),
      { code: "message_identity_conflict", requiresRefresh: true },
    );
  }
  return {
    account_id: ref.accountId,
    message_uid: ref.uid,
    folder: ref.folder,
    uid_validity: ref.uidValidity,
  };
}

function requireMessageBatch(
  messages: MessageIdentifier[],
): MessageIdentifier[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error(
      __("Select messages before changing their tags.", "pressedmail"),
    );
  }
  // Validate the entire batch, including sparse entries, before any HTTP request.
  return Array.from(messages, requireMessageIdentifier);
}

async function postMessageTagOperation(
  path: string,
  payload: object,
  failureMessage: string,
): Promise<Record<string, unknown>> {
  const principal = captureRequestPrincipal();
  const response = await apiFetch(`${getApiUrl()}/tags/${path}`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  const result = await readJson<Record<string, unknown>>(response);
  // Body parsing can finish after logout or a cross-tab account change.
  if (!isRequestPrincipalCurrent(principal)) throw new SessionExpiredError();
  if (!response.ok || result?.status !== "success") {
    throw Object.assign(
      new Error(
        typeof result?.message === "string" && result.message
          ? result.message
          : failureMessage,
      ),
      { code: result?.code, status: response.status },
    );
  }
  return result as Record<string, unknown>;
}

function requireBatchResults(
  result: Record<string, unknown>,
  messageCount: number,
): { success: number; failed: number } {
  const counts = result.results as {
    success?: unknown;
    failed?: unknown;
  } | null;
  if (
    typeof counts?.success !== "number" ||
    !Number.isSafeInteger(counts.success) ||
    counts.success < 0 ||
    typeof counts.failed !== "number" ||
    !Number.isSafeInteger(counts.failed) ||
    counts.failed < 0 ||
    counts.success + counts.failed !== messageCount
  ) {
    throw new Error(
      __(
        "The tag result was incomplete. Refresh the mailbox to check its tags.",
        "pressedmail",
      ),
    );
  }
  return { success: counts.success, failed: counts.failed };
}

/**
 * Tags Provider Component
 */
export const TagsProvider: React.FC<TagsProviderProps> = ({
  children,
  accountId,
}) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [capabilities, setCapabilities] = useState<TagCapabilities | null>(
    null,
  );

  // Account switches rerun the fetch; only the newest request may land, or
  // account A's tags could arrive late and show under account B.
  const fetchSeqRef = useRef(0);

  /**
   * Fetch tags from API.
   */
  const fetchTags = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    try {
      setLoading(true);
      setError(null);

      const url = buildApiUrl(`${getApiUrl()}/tags`, {
        account_id: accountId,
      });

      const response = await apiFetch(url);
      const data = await readJson<TagsResponse>(response);
      if (seq !== fetchSeqRef.current) return;

      if (!response.ok || !data || data.status === "error") {
        throw new Error(
          (data && typeof data.message === "string" && data.message) ||
            __("Could not load tags.", "pressedmail"),
        );
      }

      setTags(data.tags);
      setCapabilities(data.capabilities);
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      setError(
        err instanceof Error && err.message
          ? err
          : new Error(__("Could not load tags.", "pressedmail")),
      );
      setTags([]);
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [accountId]);

  /**
   * Create a new tag.
   */
  const createTag = useCallback(async (data: CreateTagData): Promise<Tag> => {
    const response = await apiFetch(`${getApiUrl()}/tags/create`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(data),
    });

    const result = (await readJson<TagOperationResponse>(response)) ??
      ({ status: "error" } as TagOperationResponse);

    if (result.status === "error" || !result.tag) {
      const error = new Error(
        result.message || __("Failed to create tag", "pressedmail"),
      );
      (error as Error & { code?: string; data?: unknown }).code = result.code;
      (error as Error & { code?: string; data?: unknown }).data = result.data;
      throw error;
    }

    // Update local state
    setTags((prev) => [...prev, result.tag!]);
    if (result.capabilities) {
      setCapabilities(result.capabilities);
    }

    return result.tag;
  }, []);

  /**
   * Update a tag.
   */
  const updateTag = useCallback(
    async (tagId: number, data: UpdateTagData): Promise<Tag> => {
      const response = await apiFetch(`${getApiUrl()}/tags/update/${tagId}`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(data),
      });

      const result = (await readJson<TagOperationResponse>(response)) ??
      ({ status: "error" } as TagOperationResponse);

      if (result.status === "error" || !result.tag) {
        throw new Error(
          result.message || __("Failed to update tag", "pressedmail"),
        );
      }

      // Update local state
      setTags((prev) =>
        prev.map((tag) => (tag.id === tagId ? result.tag! : tag)),
      );

      return result.tag;
    },
    [],
  );

  /**
   * Delete a tag.
   */
  const deleteTag = useCallback(async (tagId: number): Promise<void> => {
    const response = await apiFetch(`${getApiUrl()}/tags/delete/${tagId}`, {
      method: "POST",
      headers: JSON_HEADERS,
    });

    const result = (await readJson<TagOperationResponse>(response)) ??
      ({ status: "error" } as TagOperationResponse);

    if (result.status === "error" || !response.ok) {
      throw new Error(
        result.message || __("Failed to delete tag", "pressedmail"),
      );
    }

    // Update local state
    setTags((prev) => prev.filter((tag) => tag.id !== tagId));
    if (result.capabilities) {
      setCapabilities(result.capabilities);
    }
  }, []);

  /**
   * Assign tag to a message.
   */
  const assignTag = useCallback(
    async (
      tagId: number,
      accountId: number,
      messageUid: string,
      folder: string,
      uidValidity: string,
    ): Promise<void> => {
      const message = requireMessageIdentifier({
        account_id: accountId,
        message_uid: messageUid,
        folder,
        uid_validity: uidValidity,
      });
      await postMessageTagOperation(
        "assign",
        { tag_id: tagId, ...message },
        __("Failed to assign tag", "pressedmail"),
      );
    },
    [],
  );

  /**
   * Remove tag from a message.
   */
  const removeTag = useCallback(
    async (
      tagId: number,
      accountId: number,
      messageUid: string,
      folder: string,
      uidValidity: string,
    ): Promise<void> => {
      const message = requireMessageIdentifier({
        account_id: accountId,
        message_uid: messageUid,
        folder,
        uid_validity: uidValidity,
      });
      await postMessageTagOperation(
        "remove",
        { tag_id: tagId, ...message },
        __("Failed to remove tag", "pressedmail"),
      );
    },
    [],
  );

  /**
   * Apply one tag to many messages in a single request.
   */
  const batchAssignTag = useCallback(
    async (
      tagId: number,
      messages: MessageIdentifier[],
    ): Promise<{ success: number; failed: number }> => {
      const refs = requireMessageBatch(messages);
      const result = await postMessageTagOperation(
        "batch/assign",
        { tag_id: tagId, messages: refs },
        __("Failed to assign tag", "pressedmail"),
      );
      return requireBatchResults(result, refs.length);
    },
    [],
  );

  /**
   * Remove one tag from many messages in a single request.
   */
  const batchRemoveTag = useCallback(
    async (
      tagId: number,
      messages: MessageIdentifier[],
    ): Promise<{ success: number; failed: number }> => {
      const refs = requireMessageBatch(messages);
      const result = await postMessageTagOperation(
        "batch/remove",
        { tag_id: tagId, messages: refs },
        __("Failed to remove tag", "pressedmail"),
      );
      return requireBatchResults(result, refs.length);
    },
    [],
  );

  /**
   * Get tags for a specific message.
   */
  const getMessageTags = useCallback(
    async (
      accountId: number,
      messageUid: string,
      folder: string,
      uidValidity: string,
    ): Promise<Tag[]> => {
      const message = requireMessageIdentifier({
        account_id: accountId,
        message_uid: messageUid,
        folder,
        uid_validity: uidValidity,
      });
      const result = await postMessageTagOperation(
        "message",
        message,
        __("Failed to get message tags", "pressedmail"),
      );
      if (!Array.isArray(result.tags)) {
        throw new Error(
          __(
            "The message tag result was incomplete. Refresh the mailbox.",
            "pressedmail",
          ),
        );
      }
      return result.tags;
    },
    [],
  );

  /**
   * Reorder tags.
   */
  const reorderTags = useCallback(async (order: number[]): Promise<void> => {
    const response = await apiFetch(`${getApiUrl()}/tags/reorder`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ order }),
    });

    const result = (await readJson<TagOperationResponse>(response)) ??
      ({ status: "error" } as TagOperationResponse);

    if (result.status === "error" || !response.ok) {
      throw new Error(
        result.message || __("Failed to reorder tags", "pressedmail"),
      );
    }

    // Update local state with new order
    setTags((prev) => {
      const tagMap = new Map(prev.map((tag) => [tag.id, tag]));
      return order
        .map((id, index) => {
          const tag = tagMap.get(id);
          if (tag) {
            return { ...tag, sort_order: index };
          }
          return null;
        })
        .filter((tag): tag is Tag => tag !== null);
    });
  }, []);

  /**
   * Refresh tags.
   */
  const refreshTags = useCallback(async () => {
    await fetchTags();
  }, [fetchTags]);

  // Initial fetch
  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const value: TagsContextValue = useMemo(
    () => ({
      tags,
      loading,
      error,
      capabilities,
      refreshTags,
      createTag,
      updateTag,
      deleteTag,
      assignTag,
      removeTag,
      batchAssignTag,
      batchRemoveTag,
      getMessageTags,
      reorderTags,
    }),
    [
      tags,
      loading,
      error,
      capabilities,
      refreshTags,
      createTag,
      updateTag,
      deleteTag,
      assignTag,
      removeTag,
      batchAssignTag,
      batchRemoveTag,
      getMessageTags,
      reorderTags,
    ],
  );

  return <TagsContext.Provider value={value}>{children}</TagsContext.Provider>;
};

/**
 * Hook to use tags context.
 */
export const useTags = (): TagsContextValue => {
  const context = useContext(TagsContext);
  if (context === undefined) {
    throw new Error("useTags must be used within a TagsProvider");
  }
  return context;
};

/**
 * Hook to get tag capabilities.
 */
export const useTagCapabilities = (): TagCapabilities | null => {
  const { capabilities } = useTags();
  return capabilities;
};

/**
 * Hook to check if user can create more tags.
 */
export const useCanCreateTag = (): boolean => {
  const { capabilities } = useTags();
  return capabilities?.create ?? false;
};

export default TagsContext;
