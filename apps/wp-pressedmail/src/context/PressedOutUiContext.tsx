"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface PressedOutUiContextValue {
  showPreview: boolean;
  setShowPreview: (showPreview: boolean) => void;
  togglePreview: () => void;
  folderSheetOpen: boolean;
  setFolderSheetOpen: (open: boolean) => void;
  openFolderSheet: () => void;
  closeFolderSheet: () => void;
  /**
   * Numeric account id whose Scheduled view is active, or null when a normal
   * mail folder is selected. PressedOut renders the per-account scheduled
   * emails panel in the list pane while this is set.
   */
  scheduledAccountId: number | null;
  /** Open the Scheduled view scoped to a single account. */
  openScheduled: (accountId: number) => void;
  /** Leave the Scheduled view (back to the message list). */
  closeScheduled: () => void;
}

const PressedOutUiContext = createContext<PressedOutUiContextValue | null>(
  null,
);

export function PressedOutUiProvider({ children }: { children: ReactNode }) {
  const [showPreview, setShowPreview] = useState(false);
  const [folderSheetOpen, setFolderSheetOpen] = useState(false);
  const [scheduledAccountId, setScheduledAccountId] = useState<number | null>(
    null,
  );

  const togglePreview = useCallback(() => {
    setShowPreview((current) => !current);
  }, []);

  const openFolderSheet = useCallback(() => {
    setFolderSheetOpen(true);
  }, []);

  const closeFolderSheet = useCallback(() => {
    setFolderSheetOpen(false);
  }, []);

  const openScheduled = useCallback((accountId: number) => {
    setScheduledAccountId(accountId);
  }, []);

  const closeScheduled = useCallback(() => {
    setScheduledAccountId(null);
  }, []);

  const value = useMemo(
    () => ({
      showPreview,
      setShowPreview,
      togglePreview,
      folderSheetOpen,
      setFolderSheetOpen,
      openFolderSheet,
      closeFolderSheet,
      scheduledAccountId,
      openScheduled,
      closeScheduled,
    }),
    [
      closeFolderSheet,
      closeScheduled,
      folderSheetOpen,
      openFolderSheet,
      openScheduled,
      scheduledAccountId,
      showPreview,
      togglePreview,
    ],
  );

  return (
    <PressedOutUiContext.Provider value={value}>
      {children}
    </PressedOutUiContext.Provider>
  );
}

export function usePressedOutUi() {
  const context = useContext(PressedOutUiContext);

  if (!context) {
    throw new Error("usePressedOutUi must be used within PressedOutUiProvider");
  }

  return context;
}
