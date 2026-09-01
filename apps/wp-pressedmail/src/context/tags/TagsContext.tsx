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
  useState,
  useCallback,
  useMemo,
} from "react";
import type {
  Tag,
  TagCapabilities,
  TagsContextValue,
  CreateTagData,
  UpdateTagData,
  TagsResponse,
  TagResponse,
  TagOperationResponse,
  BatchOperationResponse,
  MessageIdentifier,
} from "../../types/tags";
import { routeApiPrefix, buildApiUrl } from "../Strings";
import { apiFetch } from "@/lib/api-client";

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
 * Get headers for API requests including WordPress nonce.
 */
const getApiHeaders = (): HeadersInit => {
  const nonce = window.pressedmailPlugin?.wpApiSettings?.nonce || "";
  if (!nonce) {
    console.warn(
      "[TagsContext] Missing nonce! window.pressedmailPlugin:",
      window.pressedmailPlugin,
    );
  }
  return {
    "Content-Type": "application/json",
  };
};

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

  /**
   * Fetch tags from API.
   */
  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const url = buildApiUrl(`${getApiUrl()}/tags`, {
        account_id: accountId,
      });

      const response = await apiFetch(url, {
        credentials: "include",
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tags: ${response.statusText}`);
      }

      const data: TagsResponse = await response.json();

      if (data.status === "error") {
        throw new Error(data.message || "Failed to fetch tags");
      }

      setTags(data.tags);
      setCapabilities(data.capabilities);
    } catch (err) {
      console.error("Error fetching tags:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  /**
   * Create a new tag.
   */
  const createTag = useCallback(async (data: CreateTagData): Promise<Tag> => {
    const response = await apiFetch(`${getApiUrl()}/tags/create`, {
      method: "POST",
      credentials: "include",
      headers: getApiHeaders(),
      body: JSON.stringify(data),
    });

    const result: TagOperationResponse = await response.json();

    if (result.status === "error" || !result.tag) {
      const error = new Error(result.message || "Failed to create tag");
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
        credentials: "include",
        headers: getApiHeaders(),
        body: JSON.stringify(data),
      });

      const result: TagOperationResponse = await response.json();

      if (result.status === "error" || !result.tag) {
        throw new Error(result.message || "Failed to update tag");
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
      credentials: "include",
      headers: getApiHeaders(),
    });

    const result: TagOperationResponse = await response.json();

    if (result.status === "error") {
      throw new Error(result.message || "Failed to delete tag");
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
      folder: string = "INBOX",
    ): Promise<void> => {
      const response = await apiFetch(`${getApiUrl()}/tags/assign`, {
        method: "POST",
        credentials: "include",
        headers: getApiHeaders(),
        body: JSON.stringify({
          tag_id: tagId,
          account_id: accountId,
          message_uid: messageUid,
          folder,
        }),
      });

      const result: TagOperationResponse = await response.json();

      if (result.status === "error") {
        throw new Error(result.message || "Failed to assign tag");
      }
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
      folder: string = "INBOX",
    ): Promise<void> => {
      const response = await apiFetch(`${getApiUrl()}/tags/remove`, {
        method: "POST",
        credentials: "include",
        headers: getApiHeaders(),
        body: JSON.stringify({
          tag_id: tagId,
          account_id: accountId,
          message_uid: messageUid,
          folder,
        }),
      });

      const result: TagOperationResponse = await response.json();

      if (result.status === "error") {
        throw new Error(result.message || "Failed to remove tag");
      }
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
      const response = await apiFetch(`${getApiUrl()}/tags/batch/assign`, {
        method: "POST",
        credentials: "include",
        headers: getApiHeaders(),
        body: JSON.stringify({ tag_id: tagId, messages }),
      });

      const result: BatchOperationResponse = await response.json();

      if (result.status === "error") {
        throw new Error(result.message || "Failed to assign tag");
      }

      return result.results ?? { success: 0, failed: 0 };
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
      const response = await apiFetch(`${getApiUrl()}/tags/batch/remove`, {
        method: "POST",
        credentials: "include",
        headers: getApiHeaders(),
        body: JSON.stringify({ tag_id: tagId, messages }),
      });

      const result: BatchOperationResponse = await response.json();

      if (result.status === "error") {
        throw new Error(result.message || "Failed to remove tag");
      }

      return result.results ?? { success: 0, failed: 0 };
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
      folder: string = "INBOX",
    ): Promise<Tag[]> => {
      const response = await apiFetch(`${getApiUrl()}/tags/message`, {
        method: "POST",
        credentials: "include",
        headers: getApiHeaders(),
        body: JSON.stringify({
          account_id: accountId,
          message_uid: messageUid,
          folder,
        }),
      });

      const result = await response.json();

      if (result.status === "error") {
        throw new Error(result.message || "Failed to get message tags");
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
      credentials: "include",
      headers: getApiHeaders(),
      body: JSON.stringify({ order }),
    });

    const result: TagOperationResponse = await response.json();

    if (result.status === "error") {
      throw new Error(result.message || "Failed to reorder tags");
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
