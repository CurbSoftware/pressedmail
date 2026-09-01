import { type ReactNode } from "react";

const DISABLED_MESSAGE = "AI features require PressedMail Pro.";

const EMPTY_CONTEXT = {
  settings: null,
  loading: false,
  error: null,
  isConfigured: false,
  fetchSettings: async () => {},
  updateSettings: async () => false,
  testConnection: async () => ({ success: false, message: DISABLED_MESSAGE }),
  clearApiKey: async () => false,
  generateDraft: async () => ({ success: false, error: DISABLED_MESSAGE }),
  enhanceText: async () => ({ success: false, error: DISABLED_MESSAGE }),
  generateReply: async () => ({ success: false, error: DISABLED_MESSAGE }),
  suggestSubject: async () => ({ success: false, error: DISABLED_MESSAGE }),
  suggestTags: async () => ({ success: false, error: DISABLED_MESSAGE }),
  summarize: async () => ({ success: false, error: DISABLED_MESSAGE }),
};

export function AIProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAI() {
  return EMPTY_CONTEXT;
}

export function useAIAvailable(): boolean {
  return false;
}
