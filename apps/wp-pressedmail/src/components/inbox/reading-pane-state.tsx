"use client";

import * as React from "react";
import { __, sprintf } from "@wordpress/i18n";

import { toast } from "@kit/ui/plugin";
import { isApiAuthError } from "@/lib/api-auth-errors";

import { useCanShowExternalImages } from "@/context/admin-settings";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useAppContext } from "@/context/AppProvider";
import {
  useAutoTagger,
  useAutoTaggerToolAvailable,
} from "@/context/auto-tagger/AutoTaggerContext";
import {
  getImagesShownCacheKey,
  hasImagesShown,
  markImagesShown,
} from "@/lib/shown-images-cache";
import { useSelectedMessagePhishingScan } from "@/hooks/useSelectedMessagePhishingScan";
import type { PhishingUiStatus } from "@/components/phishing/phishing-display";

import type { EmailMessage } from "@/types";
import type { PhishingAnalysisResult } from "@/types/phishing";

export interface ReadingPaneStateValue {
  blockedCount: number;
  setBlockedCount: (n: number) => void;
  showImages: boolean;
  effectiveShowImages: boolean;
  canShowExternalImages: boolean;
  handleShowImages: () => void;

  phishingEnabled: boolean;
  isScanning: boolean;
  phishingStatus: PhishingUiStatus;
  phishingResult: PhishingAnalysisResult | null;
  handlePhishingScan: () => Promise<void>;

  autoTaggerAvailable: boolean;
  isClassifying: boolean;
  handleAutoClassify: () => Promise<void>;
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
  const [isClassifying, setIsClassifying] = React.useState(false);

  const { preferences } = useUserPreferences();
  const canShowExternalImages = useCanShowExternalImages();
  const {
    phishingEnabled,
    isScanning,
    phishingStatus,
    analysisResult,
    runScan,
  } = useSelectedMessagePhishingScan(selectedMessage);
  const { classifyEmails } = useAutoTagger();
  const autoTaggerAvailable = useAutoTaggerToolAvailable();
  const { accounts, selectedAccount } = useAppContext();

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

  const handleAutoClassify = React.useCallback(async () => {
    if (!selectedMessage) return;

    const account = accounts.find((acc) => acc.email === selectedAccount);
    const accountId = account?.id ? Number(account.id) : null;
    if (!accountId) return;

    setIsClassifying(true);

    try {
      const result = await classifyEmails(accountId, [
        {
          uid: selectedMessage.uid || selectedMessage.id,
          folder: selectedMessage.folder || "INBOX",
          subject: selectedMessage.subject || "",
          from: selectedMessage.from || selectedMessage.email || "",
          to: selectedMessage.to || "",
          date: selectedMessage.date || "",
          body: selectedMessage.htmlBody || selectedMessage.body || "",
        },
      ]);

      if (result.status === "success" && result.results?.[0]?.tags?.length) {
        const tagNames = result.results[0].tags
          .map((t) => `${t.name} (${Math.round(t.confidence * 100)}%)`)
          .join(", ");
        toast.success(
          sprintf(__("Tags applied: %s", "pressedmail"), tagNames),
          { duration: 5000 },
        );
      } else if (result.status === "success") {
        toast.info(__("No tags matched this email.", "pressedmail"));
      } else {
        toast.error(
          result.message || __("Classification failed", "pressedmail"),
        );
      }
    } catch (error) {
      if (isApiAuthError(error)) {
        return;
      }
      console.error("Auto-classify error:", error);
      toast.error(__("Classification failed", "pressedmail"));
    } finally {
      setIsClassifying(false);
    }
  }, [selectedMessage, classifyEmails, accounts, selectedAccount]);

  return {
    blockedCount,
    setBlockedCount,
    showImages,
    effectiveShowImages,
    canShowExternalImages,
    handleShowImages,
    phishingEnabled,
    isScanning,
    phishingStatus,
    phishingResult: analysisResult,
    handlePhishingScan: runScan,
    autoTaggerAvailable,
    isClassifying,
    handleAutoClassify,
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
