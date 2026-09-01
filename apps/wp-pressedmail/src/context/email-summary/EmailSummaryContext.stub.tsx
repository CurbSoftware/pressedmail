import { type ReactNode } from "react";

/**
 * Free-build stub for the AI email-summary context. AI summaries are a Pro
 * feature (gated by __ENABLE_AI_SUMMARIZE__ / __ENABLE_AI_SETTINGS__), so the
 * free build aliases `@/context/email-summary` to this inert implementation and
 * never bundles the real EmailSummaryContext. Shape mirrors
 * EmailSummaryContextValue; all operations no-op.
 */

const EMPTY_SUMMARY_CONTEXT = {
  summaries: {} as Record<string, never>,
  isSummarizing: false,
  getSummary: () => null,
  getSummaryByKey: () => null,
  summarizeMessages: async () => ({
    successCount: 0,
    failedCount: 0,
    records: [],
    failures: [],
  }),
  deleteSummary: async () => false,
  fetchSummaryStatus: async () => {},
};

export function EmailSummaryProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useEmailSummaries() {
  return EMPTY_SUMMARY_CONTEXT;
}
