/**
 * Email Selection Context
 *
 * React context for managing email multi-selection in the inbox.
 * Provides selection state and methods for selecting/deselecting emails.
 *
 * @since 1.6.0
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import type { EmailMessage } from "@/types";
import { useInboxState } from "../InboxContext";
import { getMessageIdentityKey } from "@/lib/message-identity";
import { mergeThreadCandidates } from "@/lib/message-grouping";

export type EmailSelectionMode = "explicit" | "current-view";

export type EmailSelectionSnapshot =
  | {
      mode: "explicit";
      selectedIds: Set<string>;
    }
  | {
      mode: "current-view";
      totalCount: number;
      scopeKey: string;
      excludedIds: Set<string>;
    };

/**
 * Selection context value interface.
 */
export interface EmailSelectionContextValue {
  /** Set of selected message IDs (using string for consistent comparison) */
  selectedIds: Set<string>;
  /** Whether the selection is a concrete ID set or the entire current view. */
  selectionMode: EmailSelectionMode;
  /** Toggle selection for a single message */
  toggleSelection: (id: string | number) => void;
  /** Select all visible messages */
  selectAll: () => void;
  /** Select all messages matching the current inbox view. */
  selectCurrentView: (totalCount: number, scopeKey: string) => void;
  /** Deselect all messages */
  deselectAll: () => void;
  /** Check if a message is selected */
  isSelected: (id: string | number) => boolean;
  /** Get count of selected messages */
  getSelectedCount: () => number;
  /** Get selected email objects */
  getSelectedEmails: () => EmailMessage[];
  /** Check if any messages are selected */
  hasSelection: () => boolean;
  /** Clear all selections (alias for deselectAll) */
  clearSelection: () => void;
  /** Whether selection mode is enabled */
  selectionEnabled: boolean;
  /** Enable/disable selection mode */
  setSelectionEnabled: (enabled: boolean) => void;
  /** Select multiple messages at once */
  selectMultiple: (ids: (string | number)[]) => void;
  /** Deselect multiple messages at once */
  deselectMultiple: (ids: (string | number)[]) => void;
  /** Get a stable snapshot of the active selection. */
  getSelectionSnapshot: () => EmailSelectionSnapshot;
  /** Check if all visible messages are selected */
  isAllSelected: () => boolean;
  /** Check if some (but not all) visible messages are selected */
  isPartiallySelected: () => boolean;
}

const EmailSelectionContext = createContext<
  EmailSelectionContextValue | undefined
>(undefined);

interface EmailSelectionProviderProps {
  children: React.ReactNode;
  /** Initial selection mode state */
  initialEnabled?: boolean;
}

/**
 * Email Selection Provider Component
 *
 * Manages selection state for email multi-select functionality.
 */
export const EmailSelectionProvider: React.FC<EmailSelectionProviderProps> = ({
  children,
  initialEnabled = true,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] =
    useState<EmailSelectionMode>("explicit");
  const [currentViewTotalCount, setCurrentViewTotalCount] = useState(0);
  const [currentViewScopeKey, setCurrentViewScopeKey] = useState("");
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [selectionEnabled, setSelectionEnabled] =
    useState<boolean>(initialEnabled);

  const { messages: loadedMessages, threadGroups } = useInboxState();
  // Selection candidates include the RENDERED thread-child rows served via
  // threadGroups, each has its own checkbox, but they live only in the group
  // map, so filtering the loaded list alone dropped them from select-all,
  // bulk actions and the "all selected" math.
  const filteredMessages = useMemo(
    () => mergeThreadCandidates(loadedMessages, threadGroups),
    [loadedMessages, threadGroups],
  );

  /**
   * Normalize ID to string for consistent comparison.
   */
  const normalizeId = useCallback((id: string | number): string => {
    return String(id);
  }, []);

  const resetCurrentViewSelection = useCallback(() => {
    setCurrentViewTotalCount(0);
    setCurrentViewScopeKey("");
    setExcludedIds(new Set());
  }, []);

  /**
   * Toggle selection for a single message.
   */
  const toggleSelection = useCallback(
    (id: string | number) => {
      const normalizedId = normalizeId(id);
      if (selectionMode === "current-view") {
        setExcludedIds((prev) => {
          const next = new Set(prev);
          if (next.has(normalizedId)) {
            next.delete(normalizedId);
          } else {
            next.add(normalizedId);
          }
          return next;
        });
        return;
      }

      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(normalizedId)) {
          next.delete(normalizedId);
        } else {
          next.add(normalizedId);
        }
        return next;
      });
    },
    [selectionMode, normalizeId],
  );

  /**
   * Select all visible messages.
   */
  const selectAll = useCallback(() => {
    const allIds = filteredMessages.map((msg) =>
      normalizeId(getMessageIdentityKey(msg)),
    );
    setSelectionMode("explicit");
    resetCurrentViewSelection();
    setSelectedIds(new Set(allIds));
  }, [filteredMessages, normalizeId, resetCurrentViewSelection]);

  /**
   * Select every message matching the current inbox view.
   */
  const selectCurrentView = useCallback(
    (totalCount: number, scopeKey: string) => {
      setSelectionMode("current-view");
      setSelectedIds(new Set());
      setExcludedIds(new Set());
      setCurrentViewTotalCount(Math.max(0, totalCount));
      setCurrentViewScopeKey(scopeKey);
    },
    [],
  );

  /**
   * Deselect all messages.
   */
  const deselectAll = useCallback(() => {
    setSelectionMode("explicit");
    resetCurrentViewSelection();
    setSelectedIds(new Set());
  }, [resetCurrentViewSelection]);

  /**
   * Clear all selections (alias for deselectAll).
   */
  const clearSelection = useCallback(() => {
    deselectAll();
  }, [deselectAll]);

  /**
   * Check if a message is selected.
   */
  const isSelected = useCallback(
    (id: string | number): boolean => {
      if (selectionMode === "current-view") {
        return currentViewTotalCount > 0 && !excludedIds.has(normalizeId(id));
      }

      return selectedIds.has(normalizeId(id));
    },
    [
      selectionMode,
      currentViewTotalCount,
      excludedIds,
      selectedIds,
      normalizeId,
    ],
  );

  /**
   * Get count of selected messages.
   */
  const getSelectedCount = useCallback((): number => {
    if (selectionMode === "current-view") {
      return Math.max(0, currentViewTotalCount - excludedIds.size);
    }

    return selectedIds.size;
  }, [selectionMode, currentViewTotalCount, excludedIds, selectedIds]);

  /**
   * Get selected email objects.
   */
  const getSelectedEmails = useCallback((): EmailMessage[] => {
    if (selectionMode === "current-view") {
      return filteredMessages.filter(
        (msg) => !excludedIds.has(normalizeId(getMessageIdentityKey(msg))),
      );
    }

    return filteredMessages.filter((msg) =>
      selectedIds.has(normalizeId(getMessageIdentityKey(msg))),
    );
  }, [selectionMode, filteredMessages, excludedIds, selectedIds, normalizeId]);

  /**
   * Check if any messages are selected.
   */
  const hasSelection = useCallback((): boolean => {
    return getSelectedCount() > 0;
  }, [getSelectedCount]);

  /**
   * Select multiple messages at once.
   */
  const selectMultiple = useCallback(
    (ids: (string | number)[]) => {
      setSelectedIds((prev) => {
        const next =
          selectionMode === "current-view" ? new Set<string>() : new Set(prev);
        ids.forEach((id) => next.add(normalizeId(id)));
        return next;
      });
      setSelectionMode("explicit");
      resetCurrentViewSelection();
    },
    [selectionMode, normalizeId, resetCurrentViewSelection],
  );

  /**
   * Deselect multiple messages at once.
   */
  const deselectMultiple = useCallback(
    (ids: (string | number)[]) => {
      if (selectionMode === "current-view") {
        setExcludedIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.add(normalizeId(id)));
          return next;
        });
        return;
      }

      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(normalizeId(id)));
        return next;
      });
    },
    [selectionMode, normalizeId],
  );

  const getSelectionSnapshot = useCallback((): EmailSelectionSnapshot => {
    if (selectionMode === "current-view") {
      return {
        mode: "current-view",
        totalCount: currentViewTotalCount,
        scopeKey: currentViewScopeKey,
        excludedIds: new Set(excludedIds),
      };
    }

    return {
      mode: "explicit",
      selectedIds: new Set(selectedIds),
    };
  }, [
    selectionMode,
    currentViewTotalCount,
    currentViewScopeKey,
    excludedIds,
    selectedIds,
  ]);

  const getVisibleSelectedCount = useCallback(
    () =>
      filteredMessages.filter((msg) => {
        const id = normalizeId(getMessageIdentityKey(msg));
        return selectionMode === "current-view"
          ? !excludedIds.has(id)
          : selectedIds.has(id);
      }).length,
    [selectionMode, filteredMessages, excludedIds, selectedIds, normalizeId],
  );

  /**
   * Check if all visible messages are selected.
   */
  const isAllSelected = useCallback((): boolean => {
    if (filteredMessages.length === 0) return false;
    return getVisibleSelectedCount() === filteredMessages.length;
  }, [filteredMessages, getVisibleSelectedCount]);

  /**
   * Check if some (but not all) visible messages are selected.
   */
  const isPartiallySelected = useCallback((): boolean => {
    if (filteredMessages.length === 0) return false;
    const selectedCount = getVisibleSelectedCount();
    if (selectedCount > 0 && selectedCount < filteredMessages.length) {
      return true;
    }

    return (
      selectionMode === "current-view" &&
      selectedCount > 0 &&
      getSelectedCount() < currentViewTotalCount
    );
  }, [
    selectionMode,
    filteredMessages,
    currentViewTotalCount,
    getSelectedCount,
    getVisibleSelectedCount,
  ]);

  const value: EmailSelectionContextValue = useMemo(
    () => ({
      selectedIds,
      selectionMode,
      toggleSelection,
      selectAll,
      selectCurrentView,
      deselectAll,
      isSelected,
      getSelectedCount,
      getSelectedEmails,
      hasSelection,
      clearSelection,
      selectionEnabled,
      setSelectionEnabled,
      selectMultiple,
      deselectMultiple,
      getSelectionSnapshot,
      isAllSelected,
      isPartiallySelected,
    }),
    [
      selectedIds,
      selectionMode,
      toggleSelection,
      selectAll,
      selectCurrentView,
      deselectAll,
      isSelected,
      getSelectedCount,
      getSelectedEmails,
      hasSelection,
      clearSelection,
      selectionEnabled,
      selectMultiple,
      deselectMultiple,
      getSelectionSnapshot,
      isAllSelected,
      isPartiallySelected,
    ],
  );

  return (
    <EmailSelectionContext.Provider value={value}>
      {children}
    </EmailSelectionContext.Provider>
  );
};

/**
 * Hook to use email selection context.
 */
export const useEmailSelection = (): EmailSelectionContextValue => {
  const context = useContext(EmailSelectionContext);
  if (context === undefined) {
    throw new Error(
      "useEmailSelection must be used within an EmailSelectionProvider",
    );
  }
  return context;
};

/**
 * Hook to get selected email count.
 */
export const useSelectedCount = (): number => {
  const { getSelectedCount } = useEmailSelection();
  return getSelectedCount();
};

/**
 * Hook to check if any emails are selected.
 */
export const useHasSelection = (): boolean => {
  const { hasSelection } = useEmailSelection();
  return hasSelection();
};

export default EmailSelectionContext;
