"use client";

import * as React from "react";
import { useCanShowExternalImages } from "@/context/admin-settings";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import {
  getImagesShownCacheKey,
  hasImagesShown,
  markImagesShown,
} from "@/lib/shown-images-cache";

import type { EmailMessage } from "@/types";

export interface ReadingPaneStateValue {
  blockedCount: number;
  setBlockedCount: (n: number) => void;
  showImages: boolean;
  effectiveShowImages: boolean;
  canShowExternalImages: boolean;
  handleShowImages: () => void;
}

const ReadingPaneStateContext =
  React.createContext<ReadingPaneStateValue | null>(null);

export function useReadingPaneStateContext(): ReadingPaneStateValue | null {
  return React.useContext(ReadingPaneStateContext);
}

export function useInternalReadingPaneState(
  selectedMessage: EmailMessage | null,
): ReadingPaneStateValue {
  const [showImages, setShowImages] = React.useState(false);
  const [blockedImageCounts, setBlockedImageCounts] = React.useState<
    Record<string, number>
  >({});

  const { preferences } = useUserPreferences();
  const canShowExternalImages = useCanShowExternalImages();

  const mailId = getImagesShownCacheKey(selectedMessage);
  const blockedCount = mailId ? (blockedImageCounts[mailId] ?? 0) : 0;

  const effectiveShowImages =
    canShowExternalImages &&
    (showImages || preferences.auto_show_images || hasImagesShown(mailId));

  const setBlockedCount = React.useCallback(
    (count: number) => {
      if (!mailId) return;

      const normalizedCount = Math.max(0, count);
      setBlockedImageCounts((current) => {
        if (normalizedCount === 0) {
          if (!(mailId in current)) return current;
          const next = { ...current };
          delete next[mailId];
          return next;
        }

        if (current[mailId] === normalizedCount) return current;
        return {
          ...current,
          [mailId]: normalizedCount,
        };
      });
    },
    [mailId],
  );

  const handleShowImages = React.useCallback(() => {
    if (!canShowExternalImages) return;
    if (mailId) markImagesShown(mailId);
    setShowImages(true);
  }, [canShowExternalImages, mailId]);

  React.useEffect(() => {
    setShowImages(hasImagesShown(mailId));
  }, [mailId]);

  return {
    blockedCount,
    setBlockedCount,
    showImages,
    effectiveShowImages,
    canShowExternalImages,
    handleShowImages,
  };
}

export function ReadingPaneStateProvider({
  selectedMessage,
  children,
}: {
  selectedMessage: EmailMessage | null;
  children: React.ReactNode;
}) {
  const value = useInternalReadingPaneState(selectedMessage);
  return (
    <ReadingPaneStateContext.Provider value={value}>
      {children}
    </ReadingPaneStateContext.Provider>
  );
}
