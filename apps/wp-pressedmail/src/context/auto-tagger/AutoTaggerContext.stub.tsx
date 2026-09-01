import { type ReactNode } from "react";
import type { AutoTaggerContextValue } from "@/types/auto-tagger";

const DISABLED_MESSAGE = "Auto tagging is not included in this build.";

const EMPTY_CONTEXT: AutoTaggerContextValue = {
  settings: null,
  tags: [],
  rules: [],
  matchingRules: [],
  loading: false,
  error: null,
  isConfigured: false,
  refreshSettings: async () => {},
  updateSettings: async () => false,
  refreshTags: async () => {},
  createTag: async () => null,
  updateTag: async () => null,
  deleteTag: async () => false,
  reorderTags: async () => false,
  refreshRules: async () => {},
  createRule: async () => null,
  updateRule: async () => null,
  deleteRule: async () => false,
  refreshMatchingRules: async () => {},
  createMatchingRule: async () => null,
  updateMatchingRule: async () => null,
  deleteMatchingRule: async () => false,
  classifyEmails: async () => ({ status: "error", message: DISABLED_MESSAGE }),
  queueStatus: null,
  enqueueEmails: async () => ({ status: "error", message: DISABLED_MESSAGE }),
  fetchQueueStatus: async () => {},
  clearQueue: async () => false,
  retryFailed: async () => false,
};

export function AutoTaggerProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAutoTagger(): AutoTaggerContextValue {
  return EMPTY_CONTEXT;
}

export function useAutoTaggerAvailable(): boolean {
  return false;
}

export function useAutoTaggerToolAvailable(): boolean {
  return false;
}
