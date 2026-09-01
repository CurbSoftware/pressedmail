"use client";

import type { ReactNode } from "react";
import type {
  PhishingAnalysisResult,
  PhishingEmailData,
  PhishingUserSettings,
  PhishingAdminSettings,
  ScanScope,
} from "@/types/phishing";

interface PhishingContextValue {
  userSettings: PhishingUserSettings | null;
  adminSettings: PhishingAdminSettings | null;
  analysisCache: Map<string, PhishingAnalysisResult>;
  loading: boolean;
  error: string | null;
  isEnabled: boolean;
  isAdmin: boolean;
  fetchUserSettings: () => Promise<void>;
  fetchAdminSettings: () => Promise<void>;
  updateAdminSettings: (settings: {
    api_key?: string;
    enabled?: boolean;
    policy?: string;
    base_url?: string;
    model?: string;
    system_prompt?: string;
    auto_scan_enabled?: boolean;
  }) => Promise<boolean>;
  updateUserSettings: (settings: {
    scan_scope?: ScanScope;
  }) => Promise<boolean>;
  analyzeEmail: (
    accountId: number,
    emailData: PhishingEmailData,
    folder?: string,
    options?: { signal?: AbortSignal; force?: boolean },
  ) => Promise<PhishingAnalysisResult>;
  batchAnalyze: (
    accountId: number,
    emails: PhishingEmailData[],
    folder?: string,
  ) => Promise<{
    total: number;
    suspicious: number;
    results: Record<string, PhishingAnalysisResult>;
  } | null>;
  fetchCachedResults: (
    accountId: number,
    messageIds?: string[],
  ) => Promise<void>;
  getAnalysisResult: (messageId: string) => PhishingAnalysisResult | null;
  isEmailSuspicious: (messageId: string) => boolean;
  isAnalyzing: (messageId: string) => boolean;
  clearCache: (accountId: number) => Promise<boolean>;
  enqueuePhishingScan: (
    accountId: number,
    items: Array<{ uid: string; folder: string }>,
  ) => Promise<{ enqueued: number; skipped: number }>;
}

const disabledContext: PhishingContextValue = {
  userSettings: null,
  adminSettings: null,
  analysisCache: new Map(),
  loading: false,
  error: null,
  isEnabled: false,
  isAdmin: false,
  fetchUserSettings: async () => {},
  fetchAdminSettings: async () => {},
  updateAdminSettings: async () => false,
  updateUserSettings: async () => false,
  analyzeEmail: async () => {
    throw new Error("Phishing detection is disabled");
  },
  batchAnalyze: async () => null,
  fetchCachedResults: async () => {},
  getAnalysisResult: () => null,
  isEmailSuspicious: () => false,
  isAnalyzing: () => false,
  clearCache: async () => false,
  enqueuePhishingScan: async () => ({ enqueued: 0, skipped: 0 }),
};

export function PhishingProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function usePhishing(): PhishingContextValue {
  return disabledContext;
}

export function usePhishingEnabled(): boolean {
  return false;
}
